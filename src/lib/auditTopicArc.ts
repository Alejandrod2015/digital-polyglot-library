// Topic-level continuity audit (deterministic, Layer 1).
//
// The per-story validator (validateGeneratedStory.ts) cannot catch defects
// that live BETWEEN the stories of a topic, because it only sees one story at
// a time. This module takes the FULL ordered list of a topic's stories and
// runs the deterministic cross-story checks. The semantic ones (plot
// contradictions, dropped threads) need an LLM and live in
// judgeTopicContinuity.ts (Layer 2).
//
// Born from the A1 LATAM incident (2026-06-26): two topics shipped with the
// LAST story ending on an unresolved mini-cliffhanger, a hard plot
// contradiction across slots, and the same legend arc duplicated across
// levels. See docs/story-quality-spec.md and the user memory
// `feedback_story_arc_continuity_gate`.

export type TopicCastCharacter = {
  name?: string;
  ageBand?: string;
  gender?: string;
  role?: string;
};

export type TopicStory = {
  slotIndex: number;
  arcType?: string | null;
  title?: string | null;
  text?: string | null;
  cast?: { characters?: TopicCastCharacter[] } | null;
};

export type ArcIssue = {
  id: string;
  severity: "fail" | "warn";
  message: string;
};

const STOPWORD_SHINGLE = 6; // word length for the repetition n-gram.
const MIN_STORIES_FOR_REPEAT = 3; // a phrase must hit this many distinct stories.

// Curated signature beats that read as formulaic when reused. Matched as
// normalized substrings. Extend as new offenders surface in review.
const SIGNATURE_PHRASES: { re: RegExp; label: string }[] = [
  { re: /(toma|tomo|saca|saco|saqu\w*|sacar) una foto[^.!?]{0,40}(pero|aunque|no )/, label: 'foto que no captura el momento ("toma una foto pero…")' },
  { re: /ya no (es|soy) un extran?o/, label: 'aforismo "ya no es un extraño"' },
  { re: /se queda sin palabras/, label: '"se queda sin palabras"' },
  { re: /respira (hondo|profundo)/, label: '"respira hondo" antes de una decisión' },
];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Deterministic continuity audit over a topic's stories. Returns issues; an
 * empty array means the deterministic checks pass (the semantic judge still
 * needs to run). `topicComplete` should be true when the topic is considered
 * finished (e.g. at publish/journey-completion) — only then is a final-slot
 * cliffhanger a hard error rather than an in-progress hook.
 */
export function auditTopicArc(
  storiesIn: TopicStory[],
  opts: { topicComplete?: boolean } = {}
): ArcIssue[] {
  const issues: ArcIssue[] = [];
  const stories = [...storiesIn]
    .filter((s) => s && typeof s.slotIndex === "number")
    .sort((a, b) => a.slotIndex - b.slotIndex);
  if (stories.length === 0) return issues;

  // ── 1. final-slot-not-cliffhanger ───────────────────────────────
  const last = stories[stories.length - 1];
  if (last.arcType === "mini-cliffhanger") {
    issues.push({
      id: "final-slot-cliffhanger",
      severity: opts.topicComplete ? "fail" : "warn",
      message: `The last story of the topic (slot ${last.slotIndex}, "${last.title ?? ""}") is a mini-cliffhanger. A mini-cliffhanger belongs in the MIDDLE of a topic; the hook must be paid off by a later slot. Resolve it in this slot or add a later slot that answers it.`,
    });
  }

  // ── 2. character name reused with a different age/gender ─────────
  const byName = new Map<string, { ageBands: Set<string>; genders: Set<string>; slots: number[] }>();
  for (const s of stories) {
    for (const c of s.cast?.characters ?? []) {
      const name = (c.name ?? "").trim().toLowerCase();
      if (!name) continue;
      if (!byName.has(name)) byName.set(name, { ageBands: new Set(), genders: new Set(), slots: [] });
      const e = byName.get(name)!;
      if (c.ageBand) e.ageBands.add(c.ageBand);
      if (c.gender) e.genders.add(c.gender);
      e.slots.push(s.slotIndex);
    }
  }
  for (const [name, e] of byName) {
    if (e.ageBands.size > 1 || e.genders.size > 1) {
      issues.push({
        id: "name-role-conflict",
        severity: "warn",
        message: `Character "${name}" appears with inconsistent ${
          e.ageBands.size > 1 ? `age (${[...e.ageBands].join(", ")})` : ""
        }${e.ageBands.size > 1 && e.genders.size > 1 ? " and " : ""}${
          e.genders.size > 1 ? `gender (${[...e.genders].join(", ")})` : ""
        } across slots ${[...new Set(e.slots)].join(", ")}. Same name should be the same person.`,
      });
    }
  }

  return issues;
}

export type RepeatStory = { id?: string; label?: string; text?: string | null };
export type RepeatIssue = { id: string; severity: "warn"; message: string };

/**
 * Cross-story repetition audit. Run this over the WHOLE journey (all topics /
 * levels), NOT per topic — the formulaic beats that fatigue a binge reader
 * ("toma una foto pero…", "ya no es un extraño") recur across topics and
 * levels, so a topic-scoped pass misses them. `label` identifies each story in
 * the report (e.g. "a0/nature-adventure/slot 2").
 */
export function auditCrossStoryRepetition(stories: RepeatStory[]): RepeatIssue[] {
  const issues: RepeatIssue[] = [];
  const norm = stories.map((s, i) => ({
    label: s.label ?? s.id ?? `#${i}`,
    norm: normalize(s.text ?? ""),
  }));

  for (const { re, label } of SIGNATURE_PHRASES) {
    const hits = norm.filter((t) => re.test(t.norm)).map((t) => t.label);
    if (hits.length >= MIN_STORIES_FOR_REPEAT) {
      issues.push({
        id: "signature-phrase-repeat",
        severity: "warn",
        message: `Formulaic beat reused in ${hits.length} stories (${hits.join(", ")}): ${label}. Vary it.`,
      });
    }
  }

  const shingleToStories = new Map<string, Set<string>>();
  for (const { label, norm: n } of norm) {
    const words = n.split(" ").filter(Boolean);
    const seen = new Set<string>();
    for (let i = 0; i + STOPWORD_SHINGLE <= words.length; i++) {
      const sh = words.slice(i, i + STOPWORD_SHINGLE).join(" ");
      if (seen.has(sh)) continue;
      seen.add(sh);
      if (!shingleToStories.has(sh)) shingleToStories.set(sh, new Set());
      shingleToStories.get(sh)!.add(label);
    }
  }
  const reportedSets = new Set<string>();
  for (const [sh, labels] of shingleToStories) {
    if (labels.size < MIN_STORIES_FOR_REPEAT) continue;
    const key = [...labels].sort().join("|");
    if (reportedSets.has(key)) continue;
    reportedSets.add(key);
    issues.push({
      id: "ngram-repeat",
      severity: "warn",
      message: `Near-verbatim phrase in ${labels.size} stories (${[...labels].sort().join(", ")}): "${sh}…". Rewrite so stories don't read as reskins.`,
    });
  }
  return issues;
}
