import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createRequire } from "node:module";
import { config } from "./config.js";
import { withRetry } from "./retry.js";

const execFileAsync = promisify(execFile);
const OPENCLAW_MESSAGE_MAX_CHARS = 12000;
const require = createRequire(import.meta.url);

function parseExtraArgs(raw: string): string[] {
  return raw
    .trim()
    .split(/\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function openclawEntrypoint(): string {
  return require.resolve("openclaw/openclaw.mjs");
}

function sanitizeMessage(message: string): string {
  return message.replaceAll("\u0000", "").slice(0, OPENCLAW_MESSAGE_MAX_CHARS);
}

export async function runOpenClawAgent(message: string): Promise<string> {
  return withRetry("openclaw-agent-run", async () => {
    const safeMessage = sanitizeMessage(message);
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      [openclawEntrypoint(), "agent", "--message", safeMessage, ...parseExtraArgs(config.OPENCLAW_AGENT_ARGS)],
      {
        timeout: config.OPENCLAW_AGENT_TIMEOUT_MS,
        maxBuffer: 1024 * 1024
      }
    );

    const output = stdout.trim();
    if (output.length > 0) {
      return output;
    }

    const errOutput = stderr.trim();
    if (errOutput.length > 0) {
      throw new Error(`OpenClaw agent returned empty stdout: ${errOutput}`);
    }

    throw new Error("OpenClaw agent returned no output");
  });
}
