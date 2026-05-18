import express, { type Request, type Response } from "express";
import { pinoHttp } from "pino-http";
import { config } from "./config.js";
import { logger } from "./logger.js";
import type { AutonomousAgent } from "./agent.js";
import { PaymentHandler } from "./x402-handler.js";
import type { PaidTaskRequest } from "./types.js";
import type { RoutesConfig, RouteConfig } from "@x402/core/server";

interface PaymentOption {
  scheme: string;
  network: string;
  price: string;
  payTo: string;
  maxTimeoutSeconds: number | null;
}

interface RouteDescription {
  route: string;
  description: string | null;
  paymentOptions: PaymentOption[];
}

/** Serialize a price value to a human-readable string for the discovery endpoint. */
function serializePrice(price: unknown): string {
  if (typeof price === "function") {
    return "<dynamic>";
  }
  if (typeof price === "string" || typeof price === "number") {
    return String(price);
  }
  if (price !== null && typeof price === "object" && "amount" in price && "asset" in price) {
    return `${(price as { amount: string; asset: string }).amount} ${(price as { amount: string; asset: string }).asset}`;
  }
  return String(price);
}

/** Serialize RoutesConfig into a typed, JSON-safe summary for the discovery endpoint. */
function describeRoutes(routes: RoutesConfig): RouteDescription[] {
  if (!routes || typeof routes !== "object") {
    return [];
  }

  const normalized =
    "accepts" in routes
      ? { "* *": routes as RouteConfig }
      : (routes as Record<string, RouteConfig>);

  return Object.entries(normalized).map(([pattern, cfg]) => {
    const options = Array.isArray(cfg.accepts) ? cfg.accepts : [cfg.accepts];
    return {
      route: pattern,
      description: cfg.description ?? null,
      paymentOptions: options.map((opt) => ({
        scheme: opt.scheme,
        network: opt.network,
        price: serializePrice(opt.price),
        payTo: typeof opt.payTo === "function" ? "<dynamic>" : opt.payTo,
        maxTimeoutSeconds: opt.maxTimeoutSeconds ?? null
      }))
    };
  });
}

export function createServer(agent: AutonomousAgent) {
  const paymentHandler = new PaymentHandler();

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

  /** Discovery: returns all protected routes and their payment requirements. */
  app.get("/api/v1/payment-requirements", (_req: Request, res: Response) => {
    res.status(200).json({
      protectedRoutes: describeRoutes(paymentHandler.routes)
    });
  });

  app.use(paymentHandler.middleware());

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
