# Cryptoclaw

Cryptoclaw is a production-ready autonomous AI agent service built with:
- **OpenClaw** runtime compatibility for autonomous execution flow
- **ERC-8004** registries for identity, reputation, and validation lifecycle
- **x402** HTTP-native micropayments for paid API access

## Use case

Paid on-chain intelligence API: users pay per request (x402), receive blockchain analysis reports, and the agent continuously builds on-chain reputation via ERC-8004 updates.

## Architecture

```txt
src/
  index.ts               # App bootstrap
  server.ts              # Express API + x402-protected routes
  agent.ts               # Autonomous agent core + task fulfillment
  8004-integration.ts    # ERC-8004 registry interactions
  x402-handler.ts        # x402 middleware wiring
  wallet.ts              # Secure signer/provider creation
  llm.ts                 # LLM prompts + provider client
  retry.ts               # Retry/backoff utility
  config.ts              # Env validation and config loading
  logger.ts              # Structured logging
  types.ts               # Shared typed contracts
```

## Key design decisions

1. **Typed configuration boundary (`zod`)**
   - Fails fast at startup for missing secrets/misconfiguration.
2. **Configurable ERC-8004 function signatures**
   - Different deployments can expose variant ABI signatures; signatures are env-driven.
3. **x402 middleware at route boundary**
   - Payment checks happen before business logic execution.
4. **LLM abstraction + deterministic prompt templates**
   - Keeps provider-swappable while enforcing output constraints.
5. **Structured logging + retry wrapper**
   - Production observability and resilience against transient failures.

## Setup

```bash
git clone https://github.com/becominggiantcollective/Cryptoclaw.git
cd Cryptoclaw
npm install
cp .env.example .env
# fill in RPC, private key, registry addresses, API keys
```

## Development

```bash
npm run dev
```

## Build & run

```bash
npm run build
npm run start
```

## API

### Health

```bash
GET /healthz
```

### Paid report endpoint (x402-protected)

```bash
POST /api/v1/reports
Content-Type: application/json

{
  "requester": "0xabc...",
  "topic": "Analyze whale accumulation in Base ecosystem tokens",
  "depth": "standard",
  "chain": "base"
}
```

If payment is missing/invalid, server returns **402 Payment Required** with x402 payment requirements.

## Example LLM prompts

System prompt:

```txt
You are Cryptoclaw, an autonomous on-chain intelligence agent.
Never fabricate data, include risk and confidence, and do not promise profits.
```

Autonomy loop prompt:

```txt
Identify one high-value blockchain analysis task to execute now.
Return strict JSON: {"task":"...","reason":"...","priority":1-5}
```

## Deployment

### Docker

```bash
docker build -t cryptoclaw-agent .
docker run --env-file .env -p 3000:3000 cryptoclaw-agent
```

### PM2

```bash
npm run build
pm2 start ecosystem.config.cjs
```

## Security notes

- Never hard-code private keys or API keys.
- Use vault/KMS in production for `AGENT_PRIVATE_KEY`.
- Restrict RPC and API credentials by IP and scope.
- Rotate keys and monitor on-chain transaction activity.
