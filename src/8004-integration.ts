import { Interface, Wallet, type Log, type TransactionReceipt } from "ethers";
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

  async registerIdentity(
    agentAddress: string,
    metadataUri: string
  ): Promise<{ txHash: string; tokenId: string | null; chainId: number }> {
    const chainId = await this.assertChainConnection();
    await this.assertContractDeployed(config.ERC8004_IDENTITY_REGISTRY_ADDRESS, "identity-registry");
    const { txHash, receipt } = await this.sendRegistryTx(
      "erc8004-register-identity",
      config.ERC8004_IDENTITY_REGISTRY_ADDRESS,
      config.ERC8004_IDENTITY_REGISTER_FN,
      [agentAddress, metadataUri]
    );
    return {
      txHash,
      tokenId: this.decodeAgentRegisteredFromReceipt(receipt),
      chainId
    };
  }

  async postReputationUpdate(update: ReputationUpdate): Promise<string> {
    await this.assertContractDeployed(config.ERC8004_REPUTATION_REGISTRY_ADDRESS, "reputation-registry");
    const { txHash } = await this.sendRegistryTx(
      "erc8004-reputation-update",
      config.ERC8004_REPUTATION_REGISTRY_ADDRESS,
      config.ERC8004_REPUTATION_UPDATE_FN,
      [update.subject, update.scoreDelta, update.reason]
    );
    return txHash;
  }

  async submitValidation(record: ValidationRecord): Promise<string> {
    await this.assertContractDeployed(config.ERC8004_VALIDATION_REGISTRY_ADDRESS, "validation-registry");
    const { txHash } = await this.sendRegistryTx(
      "erc8004-validation-submit",
      config.ERC8004_VALIDATION_REGISTRY_ADDRESS,
      config.ERC8004_VALIDATION_SUBMIT_FN,
      [record.subject, record.payloadUri, record.passed]
    );
    return txHash;
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
  ): Promise<{ txHash: string; receipt: TransactionReceipt }> {
    return withRetry(operationName, async () => {
      const iface = new Interface([`function ${fnSignature}`]);
      const method = functionName(fnSignature);
      const data = iface.encodeFunctionData(method, args);
      const tx = await this.wallet.sendTransaction({
        to: contractAddress,
        data
      });
      const receipt = await tx.wait();
      if (!receipt) {
        throw new Error(`No transaction receipt for operation '${operationName}'`);
      }
      logger.info({ txHash: receipt.hash, operationName }, "ERC-8004 tx submitted");
      return { txHash: receipt.hash, receipt };
    });
  }

  private async assertChainConnection(): Promise<number> {
    const provider = this.wallet.provider;
    if (!provider) {
      throw new Error("Wallet provider is not configured");
    }
    const network = await provider.getNetwork();
    const chainId = Number(network.chainId);
    if (chainId !== config.CHAIN_ID) {
      throw new Error(`Connected chain id ${chainId} does not match configured CHAIN_ID ${config.CHAIN_ID}`);
    }
    return chainId;
  }

  private async assertContractDeployed(contractAddress: string, label: string): Promise<void> {
    const provider = this.wallet.provider;
    if (!provider) {
      throw new Error("Wallet provider is not configured");
    }
    const code = await provider.getCode(contractAddress);
    if (code === "0x") {
      throw new Error(`No contract deployed for ${label} at ${contractAddress}`);
    }
  }

  private decodeAgentRegisteredFromReceipt(receipt: TransactionReceipt): string | null {
    for (const log of receipt.logs) {
      const decoded = this.decodeAgentRegistered(log);
      if (decoded) {
        return decoded.id;
      }
    }
    logger.warn({ txHash: receipt.hash }, "no AgentRegistered event found in identity registration receipt");
    return null;
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
