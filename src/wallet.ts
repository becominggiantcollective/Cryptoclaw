import { JsonRpcProvider, Wallet } from "ethers";
import { config } from "./config.js";

export function createProvider(): JsonRpcProvider {
  return new JsonRpcProvider(config.RPC_URL, config.CHAIN_ID);
}

export function createSigner(provider = createProvider()): Wallet {
  return new Wallet(config.AGENT_PRIVATE_KEY, provider);
}
