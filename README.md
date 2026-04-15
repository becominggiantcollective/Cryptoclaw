# Cryptoclaw

Cryptoclaw is a personal AI assistant built on [OpenClaw](https://github.com/openclaw/openclaw) — a free, open-source AI agent framework that runs on your own machine and responds through the messaging channels you already use (WhatsApp, Telegram, Discord, Slack, and more).

## Prerequisites

- **Node.js** ≥ 22.14.0 (or use [Docker](#docker))
- An API key for at least one LLM provider (OpenAI, Anthropic, Gemini, …)

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/becominggiantcollective/Cryptoclaw.git
cd Cryptoclaw
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure

Copy the example environment file and fill in your credentials:

```bash
cp .env.example .env
```

Edit `.env` and set at minimum:

| Variable | Description |
|---|---|
| `OPENCLAW_GATEWAY_TOKEN` | Auth token for the gateway (`openssl rand -hex 32`) |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `GEMINI_API_KEY` | API key for your preferred LLM provider |

See `.env.example` for the full list of available options.

### 4. Run

Start the guided onboarding wizard (recommended for first-time setup):

```bash
npx openclaw onboard
```

Or start the gateway directly:

```bash
npx openclaw gateway
```

## Docker

You can also run Cryptoclaw via Docker using the OpenClaw image:

```bash
# Pull the latest OpenClaw image
docker pull ghcr.io/openclaw/openclaw:latest

# Run the gateway (adjust paths as needed)
docker run -d \
  --env-file .env \
  -v "$HOME/.openclaw:/home/node/.openclaw" \
  -p 18789:18789 \
  ghcr.io/openclaw/openclaw:latest
```

## Documentation

Full OpenClaw documentation: <https://docs.openclaw.ai>

## License

This project is licensed under the [MIT License](LICENSE).
OpenClaw is also MIT-licensed — see the [OpenClaw repository](https://github.com/openclaw/openclaw/blob/main/LICENSE).