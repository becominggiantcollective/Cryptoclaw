import { Wallet } from "ethers";
import { config } from "./config.js";
import { ERC8004Integration } from "./8004-integration.js";
import { logger } from "./logger.js";
import { AGENT_SYSTEM_PROMPT, AUTONOMY_PROMPT, runLLM } from "./llm.js";
import type { PaidTaskRequest, PaidTaskResult } from "./types.js";

export class AutonomousAgent {
  private loopHandle: NodeJS.Timeout | null = null;

  constructor(
    private readonly wallet: Wallet,
    private readonly registry: ERC8004Integration
  ) {}

  async bootstrap(): Promise<void> {
    const address = await this.wallet.getAddress();
    const registration = await this.registry.registerIdentity(address, config.AGENT_METADATA_URI);
    try {
      await this.registry.postReputationUpdate({
        subject: address,
        scoreDelta: BigInt(1),
        reason: `Identity registered on chain ${registration.chainId}`
      });
    } catch (error) {
      logger.warn(
        {
          err: error,
          address,
          chainId: registration.chainId,
          registrationTxHash: registration.txHash
        },
        "identity was registered but initial reputation update failed"
      );
    }

    logger.info(
      {
        address,
        chainId: registration.chainId,
        registrationTxHash: registration.txHash,
        tokenId: registration.tokenId
      },
      "agent bootstrapped with erc8004 identity registration and initial reputation"
    );
  }

  startAutonomyLoop(): void {
    if (this.loopHandle) {
      return;
    }

    this.loopHandle = setInterval(async () => {
      try {
        const decision = await this.nextAutonomousTask();
        logger.info({ decision }, "autonomous task candidate generated");
      } catch (error) {
        logger.error({ err: error }, "autonomous loop iteration failed");
      }
    }, config.AUTONOMY_LOOP_MS);
  }

  stopAutonomyLoop(): void {
    if (!this.loopHandle) {
      return;
    }
    clearInterval(this.loopHandle);
    this.loopHandle = null;
  }

  async fulfillPaidTask(input: PaidTaskRequest): Promise<PaidTaskResult> {
    const userPrompt = [
      `Requester: ${input.requester}`,
      `Topic: ${input.topic}`,
      `Depth: ${input.depth ?? "standard"}`,
      `Chain focus: ${input.chain ?? "base"}`,
      "Output format:",
      "1) Executive summary",
      "2) Key on-chain findings",
      "3) Risk section",
      "4) Actionable next steps",
      "5) Confidence score from 0 to 1"
    ].join("\n");

    const report = await runLLM([
      { role: "system", content: AGENT_SYSTEM_PROMPT },
      { role: "user", content: userPrompt }
    ]);

    const confidence = this.extractConfidence(report);

    await this.registry.postReputationUpdate({
      subject: await this.wallet.getAddress(),
      scoreDelta: BigInt(Math.round(confidence * 100)),
      reason: "Paid task delivered"
    });

    return {
      report,
      confidence,
      sources: ["on-chain RPC", "LLM synthesis"],
      generatedAt: new Date().toISOString()
    };
  }

  private async nextAutonomousTask(): Promise<string> {
    if (config.OPENCLAW_EXECUTION_MODE === "gateway") {
      return runLLM([
        { role: "system", content: AGENT_SYSTEM_PROMPT },
        { role: "user", content: AUTONOMY_PROMPT }
      ]);
    }

    return JSON.stringify({
      task: "Monitor high-fee whale flows and prepare premium summary",
      reason: "Fallback local autonomy mode",
      priority: 3
    });
  }

  private extractConfidence(text: string): number {
    const match = text.match(/confidence\s*[:=]\s*([0-1](?:\.\d+)?)/i);
    if (!match) {
      return 0.72;
    }

    const value = Number.parseFloat(match[1] ?? "0.72");
    if (!Number.isFinite(value)) {
      return 0.72;
    }

    return Math.min(1, Math.max(0, value));
  }
}
