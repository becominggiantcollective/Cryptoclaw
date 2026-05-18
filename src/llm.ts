import { withRetry } from "./retry.js";
import { config } from "./config.js";
import type { LLMMessage } from "./types.js";

interface ChatCompletionResponse {
  choices: Array<{
    message?: {
      content?: string;
    };
  }>;
}

export const AGENT_SYSTEM_PROMPT = `You are Cryptoclaw, an autonomous on-chain intelligence agent.
Rules:
1) Never fabricate data you cannot verify.
2) Provide concise, high-value analysis for paid users.
3) Include explicit confidence and limitations.
4) Recommend risk-aware actions; never guarantee profit.
5) Prefer Base/Scroll-compatible workflows for low fees.`;

export const AUTONOMY_PROMPT = `You are running in autonomous mode.
Identify one high-value blockchain analysis task to execute now, given current context.
Return strict JSON: {"task":"...","reason":"...","priority":1-5}.`;

export async function runLLM(messages: LLMMessage[]): Promise<string> {
  return withRetry("llm-chat-completion", async () => {
    const res = await fetch(`${config.LLM_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.LLM_API_KEY}`
      },
      body: JSON.stringify({
        model: config.LLM_MODEL,
        messages,
        temperature: 0.2
      })
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`LLM request failed (${res.status}): ${body}`);
    }

    const payload = (await res.json()) as ChatCompletionResponse;
    const content = payload.choices[0]?.message?.content?.trim();

    if (!content) {
      throw new Error("LLM returned empty content");
    }

    return content;
  });
}
