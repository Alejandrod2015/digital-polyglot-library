import { runContentAgent } from "@/agents/content/agent";
import type { ContentAgentRun } from "@/agents/content/types";

export type ParallelContentResult = {
  briefId: string;
  result: (ContentAgentRun & { runId: string }) | null;
  error: string | null;
};

/**
 * Run Content Agent on multiple briefs with controlled concurrency.
 * Returns results in the same order as input briefIds.
 */
export async function runContentAgentParallel(
  briefIds: string[],
  concurrency: number = 3
): Promise<ParallelContentResult[]> {
  const results: ParallelContentResult[] = new Array(briefIds.length);
  let cursor = 0;

  async function worker() {
    while (cursor < briefIds.length) {
      const idx = cursor++;
      const briefId = briefIds[idx];
      try {
        const result = await runContentAgent(briefId);
        results[idx] = { briefId, result, error: null };
      } catch (err) {
        results[idx] = {
          briefId,
          result: null,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }
  }

  // Spawn `concurrency` workers
  const workers = Array.from({ length: Math.min(concurrency, briefIds.length) }, () => worker());
  await Promise.all(workers);

  return results;
}
