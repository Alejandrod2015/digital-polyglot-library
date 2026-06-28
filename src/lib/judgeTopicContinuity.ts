// Topic-level continuity judge (semantic, Layer 2).
//
// Deterministic checks (auditTopicArc.ts) catch arcType / name / verbatim
// repetition. They CANNOT catch a plot contradiction or a dropped thread —
// those need reading the stories in order and reasoning about the narrative.
// This module sends a topic's ordered stories to an LLM and asks it to find:
//   1. contradictions between stories (state established in one, broken later)
//   2. setups/threads opened and never resolved
//   3. whether the LAST story ends on an unresolved hook (a cliffhanger with
//      no payoff anywhere in the topic)
//
// Born from the A1 LATAM incident (2026-06-26): the Places arc had Diego reach
// the sea in story 1 then travel toward it "for the first time" in story 2 — a
// hard contradiction no regex sees. See docs/story-quality-spec.md and user
// memory `feedback_story_arc_continuity_gate`.

import OpenAI from "openai";

export type JudgeStory = { slotIndex: number; title?: string | null; text?: string | null };

export type ContinuityVerdict = {
  verdict: "pass" | "issues";
  contradictions: { slots: number[]; detail: string }[];
  droppedThreads: { slot: number; detail: string }[];
  finalCliffhangerUnresolved: boolean;
  finalCliffhangerDetail: string;
  notes: string;
};

const SYSTEM = `You are a strict story-continuity reviewer for a language-learning app. You receive the ordered stories of ONE topic (slots 1..N) that share recurring characters and are read in sequence. The intended design is an EPISODIC SERIES: same characters, each story self-contained, occasional hooks that ARE paid off — NOT one continuous novel, and NOT unrelated vignettes.

Find ONLY real defects, with the exact slot numbers and a short quote:
1. contradictions: a fact/state established in an earlier slot is broken in a later slot (e.g. a character already reached a place, then is treated as not-yet-arrived).
2. droppedThreads: a setup/question/promise opened in one slot that NO later slot addresses when it clearly should.
3. finalCliffhangerUnresolved: the LAST slot ends on an open hook that nothing in the topic resolves (a mini-cliffhanger is fine MID-topic, never as the final story).

Do NOT flag: stories being separate situations with the same cast (that is correct and good), thematic-only links, or a mid-topic cliffhanger that a later slot answers. Be precise and conservative; only report what the text supports. Respond as JSON.`;

/**
 * Run the semantic continuity judge over a topic's stories. Requires
 * OPENAI_API_KEY in the environment (present in production; absent in some
 * local/CI envs — callers should treat a thrown error as "judge unavailable"
 * and fall back to the deterministic audit + a human read, never as "pass").
 */
export async function judgeTopicContinuity(
  storiesIn: JudgeStory[],
  ctx: { language?: string; topic?: string } = {}
): Promise<ContinuityVerdict> {
  const stories = [...storiesIn].sort((a, b) => a.slotIndex - b.slotIndex);
  if (stories.length < 2) {
    return {
      verdict: "pass",
      contradictions: [],
      droppedThreads: [],
      finalCliffhangerUnresolved: false,
      finalCliffhangerDetail: "",
      notes: "Fewer than 2 stories; nothing to compare.",
    };
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  const body = stories
    .map((s) => `### SLOT ${s.slotIndex} — ${s.title ?? ""}\n${(s.text ?? "").trim()}`)
    .join("\n\n");

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: `Topic: ${ctx.topic ?? "(unknown)"} · Language: ${ctx.language ?? "es"}\nThere are ${stories.length} stories. Review them in order.\n\n${body}\n\nReturn JSON with exactly these keys: verdict ("pass" or "issues"), contradictions (array of {slots:number[], detail:string}), droppedThreads (array of {slot:number, detail:string}), finalCliffhangerUnresolved (boolean), finalCliffhangerDetail (string), notes (string).`,
      },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  let parsed: Partial<ContinuityVerdict> = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = {};
  }

  const contradictions = Array.isArray(parsed.contradictions) ? parsed.contradictions : [];
  const droppedThreads = Array.isArray(parsed.droppedThreads) ? parsed.droppedThreads : [];
  const finalCliffhangerUnresolved = Boolean(parsed.finalCliffhangerUnresolved);
  const hasIssues =
    contradictions.length > 0 || droppedThreads.length > 0 || finalCliffhangerUnresolved;

  return {
    verdict: hasIssues ? "issues" : "pass",
    contradictions,
    droppedThreads,
    finalCliffhangerUnresolved,
    finalCliffhangerDetail: typeof parsed.finalCliffhangerDetail === "string" ? parsed.finalCliffhangerDetail : "",
    notes: typeof parsed.notes === "string" ? parsed.notes : "",
  };
}
