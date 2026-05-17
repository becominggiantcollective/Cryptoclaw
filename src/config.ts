import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.string().default("info"),

  RPC_URL: z.url(),
  CHAIN_ID: z.coerce.number().int().positive().default(84532),
  AGENT_PRIVATE_KEY: z.string().min(32),
  AGENT_PAYOUT_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/),

  ERC8004_IDENTITY_REGISTRY_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  ERC8004_REPUTATION_REGISTRY_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  ERC8004_VALIDATION_REGISTRY_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/),

  ERC8004_IDENTITY_REGISTER_FN: z.string().default("registerIdentity(address,string)"),
  ERC8004_REPUTATION_UPDATE_FN: z.string().default("updateReputation(address,int256,string)"),
  ERC8004_VALIDATION_SUBMIT_FN: z.string().default("submitValidation(address,string,bool)"),

  AGENT_METADATA_URI: z.string().default("ipfs://cryptoclaw/agent-metadata.json"),
  AGENT_INITIAL_REPUTATION_DELTA: z.coerce.number().int().default(1),

  X402_FACILITATOR_URL: z.url().default("https://facilitator.x402.org"),
  X402_NETWORK: z.string().default("eip155:84532"),
  X402_PRICE_USD: z.string().default("$0.25"),

  LLM_BASE_URL: z.url().default("https://api.openai.com/v1"),
  LLM_MODEL: z.string().default("gpt-4.1"),
  LLM_API_KEY: z.string().min(10),

  AUTONOMY_LOOP_MS: z.coerce.number().int().positive().default(120000),
  OPENCLAW_EXECUTION_MODE: z.enum(["gateway", "local"]).default("gateway")
});

export type AppConfig = z.infer<typeof schema>;
export const config: AppConfig = schema.parse(process.env);
