/**
 * Structured agent logger for observability.
 *
 * Outputs JSON-formatted log lines that can be ingested by
 * Sentry, Datadog, or any structured-log pipeline.
 *
 * Usage:
 *   import { agentLog } from "@/lib/agentLogger";
 *   agentLog.info("content", "Story generated", { draftId, wordCount });
 *   agentLog.error("qa", "LLM quality check failed", { error: msg });
 */

export type LogLevel = "debug" | "info" | "warn" | "error";
export type AgentName = "planner" | "content" | "qa" | "publish" | "pipeline" | "safety";

type LogEntry = {
  timestamp: string;
  level: LogLevel;
  agent: AgentName;
  message: string;
  durationMs?: number;
  meta?: Record<string, unknown>;
};

function emit(entry: LogEntry) {
  const line = JSON.stringify(entry);
  switch (entry.level) {
    case "error":
      console.error(line);
      break;
    case "warn":
      console.warn(line);
      break;
    case "debug":
      // Only log debug in development
      if (process.env.NODE_ENV === "development") {
        console.debug(line);
      }
      break;
    default:
      console.log(line);
  }
}

function createLogFn(level: LogLevel) {
  return (
    agent: AgentName,
    message: string,
    meta?: Record<string, unknown>
  ) => {
    emit({
      timestamp: new Date().toISOString(),
      level,
      agent,
      message,
      durationMs: meta?.durationMs as number | undefined,
      meta,
    });
  };
}

export const agentLog = {
  debug: createLogFn("debug"),
  info: createLogFn("info"),
  warn: createLogFn("warn"),
  error: createLogFn("error"),
};

/**
 * Timer utility for measuring agent step durations.
 *
 *   const timer = agentTimer("content", "generateStory");
 *   // ... do work ...
 *   timer.end({ wordCount: 350 }); // logs duration + metadata
 */
export function agentTimer(agent: AgentName, step: string) {
  const start = performance.now();
  return {
    end(meta?: Record<string, unknown>) {
      const durationMs = Math.round(performance.now() - start);
      agentLog.info(agent, `${step} completed`, {
        ...meta,
        durationMs,
        step,
      });
      return durationMs;
    },
    elapsed() {
      return Math.round(performance.now() - start);
    },
  };
}

/**
 * Estimate token cost for an LLM call.
 * Rough approximation: 1 token ≈ 4 characters for English.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// Cost per 1K tokens (USD) — approximate as of 2025
const TOKEN_COSTS: Record<string, { input: number; output: number }> = {
  "gpt-4o": { input: 0.0025, output: 0.01 },
  "gpt-4o-mini": { input: 0.00015, output: 0.0006 },
  "claude-sonnet-4-20250514": { input: 0.003, output: 0.015 },
};

export function estimateCostUSD(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const costs = TOKEN_COSTS[model] ?? TOKEN_COSTS["gpt-4o"];
  return (
    (inputTokens / 1000) * costs.input + (outputTokens / 1000) * costs.output
  );
}
