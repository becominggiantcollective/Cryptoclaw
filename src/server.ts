import express, { type Request, type Response } from "express";
import { pinoHttp } from "pino-http";
import { config } from "./config.js";
import { logger } from "./logger.js";
import type { AutonomousAgent } from "./agent.js";
import { createX402Middleware } from "./x402-handler.js";
import type { PaidTaskRequest } from "./types.js";

export function createServer(agent: AutonomousAgent) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));
  app.use(
    pinoHttp({
      logger,
      serializers: {
        req: (req: Request) => ({ method: req.method, url: req.url }),
        res: (res: Response) => ({ statusCode: res.statusCode })
      }
    })
  );

  app.get("/healthz", (_req: Request, res: Response) => {
    res.status(200).json({ ok: true, ts: new Date().toISOString() });
  });

  app.use(createX402Middleware());

  app.post("/api/v1/reports", async (req: Request, res: Response) => {
    try {
      const body = req.body as Partial<PaidTaskRequest>;
      if (!body.requester || !body.topic) {
        res.status(400).json({ error: "requester and topic are required" });
        return;
      }

      const payload: PaidTaskRequest = {
        requester: body.requester,
        topic: body.topic
      };

      if (body.depth) {
        payload.depth = body.depth;
      }
      if (body.chain) {
        payload.chain = body.chain;
      }

      const result = await agent.fulfillPaidTask(payload);

      res.status(200).json(result);
    } catch (error) {
      logger.error({ err: error }, "failed to fulfill paid request");
      res.status(500).json({ error: "failed to process request" });
    }
  });

  app.get("/api/v1/llm-prompts", (_req, res) => {
    res.status(200).json({
      prompts: {
        system: "You are Cryptoclaw, an autonomous on-chain intelligence agent.",
        autonomy: "Return strict JSON: {task,reason,priority}."
      }
    });
  });

  return app;
}

export function startServer(app: ReturnType<typeof createServer>): void {
  app.listen(config.PORT, () => {
    logger.info({ port: config.PORT }, "server listening");
  });
}
