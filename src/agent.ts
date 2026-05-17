import { Wallet } from "ethers";
import { config } from "./config.js";
import { ERC8004Integration } from "./8004-integration.js";
import { logger } from "./logger.js";
import { AGENT_SYSTEM_PROMPT, AUTONOMY_PROMPT, runLLM } from "./llm.js";
import { runOpenClawAgent } from "./openclaw.js";
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
        scoreDelta: BigInt(config.AGENT_INITIAL_REPUTATION_DELTA),
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
      "agent bootstrapped with ERC-8004 identity registration and initial reputation"
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
    const walletAddress = await this.wallet.getAddress();
    const userPrompt = [
      `Requester: ${input.requester}`,
      `Topic: ${input.topic}`,
      `Depth: ${input.depth ?? "standard"}`,
      `Chain focus: ${input.chain ?? "base"}`,
      `Wallet: ${walletAddress}`,
      `Chain ID: ${config.CHAIN_ID}`,
      "Output format:",
      "1) Executive summary",
      "2) Key on-chain findings",
      "3) Risk section",
      "4) Actionable next steps",
      "5) Confidence score from 0 to 1"
    ].join("\n");

    const report =
      config.OPENCLAW_EXECUTION_MODE === "gateway"
        ? await runOpenClawAgent(
            [
              AGENT_SYSTEM_PROMPT,
              "Use planning, tools, and execution to generate a paid report for this request.",
              userPrompt
            ].join("\n\n")
          )
        : await runLLM([
            { role: "system", content: AGENT_SYSTEM_PROMPT },
            { role: "user", content: userPrompt }
          ]);

    const confidence = this.extractConfidence(report);

    await this.registry.postReputationUpdate({
      subject: walletAddress,
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
      const walletAddress = await this.wallet.getAddress();
      return runOpenClawAgent(
        [
          AGENT_SYSTEM_PROMPT,
          AUTONOMY_PROMPT,
          `Wallet: ${walletAddress}`,
          `Chain ID: ${config.CHAIN_ID}`,
          "Use available tools when helpful.",
          "Respond in strict JSON with this shape:",
          '{"planning":{"task":"...","reason":"...","priority":1-5},"execution":{"actions":["..."],"result":"..."}}'
        ].join("\n\n")
      );
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
