/**
 * Unified LLM provider abstraction.
 *
 * Set env var `LLM_PROVIDER=anthropic` to use Claude.
 * Default is `openai`.
 *
 * Required env vars per provider:
 *   openai    → OPENAI_API_KEY
 *   anthropic → ANTHROPIC_API_KEY
 */

import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

export type LLMProvider = "openai" | "anthropic";

export function getProvider(): LLMProvider {
  const raw = (process.env.LLM_PROVIDER ?? "openai").toLowerCase().trim();
  if (raw === "anthropic" || raw === "claude") return "anthropic";
  return "openai";
}

// ── Lazy-init singletons ──

let _openai: OpenAI | null = null;
let _anthropic: Anthropic | null = null;

function getOpenAI(): OpenAI {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  return _openai;
}

function getAnthropic(): Anthropic {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  return _anthropic;
}

// ── Shared interface ──

export type LLMMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type LLMOptions = {
  model?: string;
  temperature?: number;
  maxTokens?: number;
};

const DEFAULT_MODELS: Record<LLMProvider, string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-sonnet-4-20250514",
};

/**
 * Send a chat completion to the configured LLM provider.
 * Returns the assistant's text response.
 */
export async function chatCompletion(
  messages: LLMMessage[],
  options: LLMOptions = {}
): Promise<string> {
  const provider = getProvider();
  const model = options.model ?? DEFAULT_MODELS[provider];
  const temperature = options.temperature ?? 0.7;
  const maxTokens = options.maxTokens ?? 2048;

  if (provider === "anthropic") {
    return chatAnthropic(messages, model, temperature, maxTokens);
  }
  return chatOpenAI(messages, model, temperature, maxTokens);
}

// ── OpenAI implementation ──

async function chatOpenAI(
  messages: LLMMessage[],
  model: string,
  temperature: number,
  maxTokens: number
): Promise<string> {
  const openai = getOpenAI();
  const response = await openai.chat.completions.create({
    model,
    temperature,
    max_tokens: maxTokens,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });
  return response.choices[0]?.message?.content?.trim() ?? "";
}

// ── Anthropic implementation ──

async function chatAnthropic(
  messages: LLMMessage[],
  model: string,
  temperature: number,
  maxTokens: number
): Promise<string> {
  const anthropic = getAnthropic();

  // Anthropic separates system from messages
  const systemMsg = messages.find((m) => m.role === "system");
  const userMessages = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

  const response = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    temperature,
    system: systemMsg?.content ?? "",
    messages: userMessages,
  });

  const block = response.content[0];
  if (block.type === "text") return block.text.trim();
  return "";
}

/**
 * Extract JSON from an LLM response that may contain markdown fences.
 */
export function extractJSON<T = unknown>(raw: string): T {
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  return JSON.parse(cleaned) as T;
}
