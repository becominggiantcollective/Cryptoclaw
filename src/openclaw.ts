import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { withRetry } from "./retry.js";

const execFileAsync = promisify(execFile);
const OPENCLAW_MESSAGE_MAX_CHARS = 12000;

function parseExtraArgs(raw: string): string[] {
  return raw
    .trim()
    .split(/\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function openclawEntrypoint(): string {
  return fileURLToPath(new URL("../node_modules/openclaw/openclaw.mjs", import.meta.url));
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
