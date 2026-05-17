import { Interface, Wallet, type Log } from "ethers";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { withRetry } from "./retry.js";
import type { ReputationUpdate, ValidationRecord } from "./types.js";

const AGENT_REGISTERED_EVENT = new Interface([
  "event AgentRegistered(address indexed agent, string metadataUri, uint256 id)"
]);

function functionName(signature: string): string {
  return signature.split("(")[0] ?? signature;
}

export class ERC8004Integration {
  constructor(private readonly wallet: Wallet) {}

  async registerIdentity(agentAddress: string, metadataUri: string): Promise<string> {
    return this.sendRegistryTx(
      "erc8004-register-identity",
      config.ERC8004_IDENTITY_REGISTRY_ADDRESS,
      config.ERC8004_IDENTITY_REGISTER_FN,
      [agentAddress, metadataUri]
    );
  }

  async postReputationUpdate(update: ReputationUpdate): Promise<string> {
    return this.sendRegistryTx(
      "erc8004-reputation-update",
      config.ERC8004_REPUTATION_REGISTRY_ADDRESS,
      config.ERC8004_REPUTATION_UPDATE_FN,
      [update.subject, update.scoreDelta, update.reason]
    );
  }

  async submitValidation(record: ValidationRecord): Promise<string> {
    return this.sendRegistryTx(
      "erc8004-validation-submit",
      config.ERC8004_VALIDATION_REGISTRY_ADDRESS,
      config.ERC8004_VALIDATION_SUBMIT_FN,
      [record.subject, record.payloadUri, record.passed]
    );
  }

  async discoverRecentAgents(fromBlock = -3000): Promise<Array<{ agent: string; metadataUri: string; id: string }>> {
    const provider = this.wallet.provider;
    if (!provider) {
      return [];
    }

    const latest = await provider.getBlockNumber();
    const start = Math.max(0, latest + fromBlock);
    const event = AGENT_REGISTERED_EVENT.getEvent("AgentRegistered");
    if (!event) {
      return [];
    }

    const logs = await provider.getLogs({
      fromBlock: start,
      toBlock: latest,
      address: config.ERC8004_IDENTITY_REGISTRY_ADDRESS,
      topics: [event.topicHash]
    });

    return logs
      .map((log) => this.decodeAgentRegistered(log))
      .filter((item): item is { agent: string; metadataUri: string; id: string } => item !== null);
  }

  private async sendRegistryTx(
    operationName: string,
    contractAddress: string,
    fnSignature: string,
    args: unknown[]
  ): Promise<string> {
    return withRetry(operationName, async () => {
      const iface = new Interface([`function ${fnSignature}`]);
      const method = functionName(fnSignature);
      const data = iface.encodeFunctionData(method, args);
      const tx = await this.wallet.sendTransaction({
        to: contractAddress,
        data
      });
      const receipt = await tx.wait();
      logger.info({ txHash: receipt?.hash ?? tx.hash, operationName }, "erc8004 tx submitted");
      return receipt?.hash ?? tx.hash;
    });
  }

  private decodeAgentRegistered(log: Log): { agent: string; metadataUri: string; id: string } | null {
    try {
      const decoded = AGENT_REGISTERED_EVENT.decodeEventLog("AgentRegistered", log.data, log.topics);
      return {
        agent: String(decoded.agent),
        metadataUri: String(decoded.metadataUri),
        id: decoded.id.toString()
      };
    } catch {
      return null;
    }
  }
}
