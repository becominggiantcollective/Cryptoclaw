import { createSigner } from "./wallet.js";
import { ERC8004Integration } from "./8004-integration.js";
import { AutonomousAgent } from "./agent.js";
import { createServer, startServer } from "./server.js";
import { logger } from "./logger.js";

async function main(): Promise<void> {
  const signer = createSigner();
  const registry = new ERC8004Integration(signer);
  const agent = new AutonomousAgent(signer, registry);

  await agent.bootstrap();
  agent.startAutonomyLoop();

  const app = createServer(agent);
  startServer(app);
}

main().catch((error) => {
  logger.fatal({ err: error }, "fatal startup failure");
  process.exit(1);
});
