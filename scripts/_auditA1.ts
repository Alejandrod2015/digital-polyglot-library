/**
 * Auditoría de un journey entero, historia por historia, LEYENDO DE LA BASE.
 *
 * Corre el validador CANÓNICO (`validateGeneratedStory`) con el mismo contexto
 * de hermanos que usa `saveStory.ts` (los del mismo tema, en orden de slot), y
 * añade las dimensiones que el validador NO puntúa por sí solo y que hay que
 * mirar a mano: frases por párrafo, porcentaje de habla citada, reparto de
 * vocab por bloque de lectura y categorías sensoriales.
 *
 *   npx tsx scripts/_auditA1.ts <journeyId>
 *
 * No escribe nada. Es solo lectura.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

import { PrismaClient } from "../src/generated/prisma";
import {
  validateGeneratedStory,
  extractStoryMotifs,
  extractProperNouns,
  type ExistingStorySummary,
} from "../src/lib/validateGeneratedStory";
import { quotedStats } from "./_quotedRatio";

const prisma = new PrismaClient();

const TOPIC_ORDER = [
  "neighbours", "the-local-bar", "shopping-for-food", "spanish-hours",
  "around-the-house", "chemist-and-doctor", "village-fiesta",
];

// Los 4 checks que `--narrator` exime a propósito: miden formato diálogo.
const NARRATOR_EXEMPT = new Set(["body-dialogue-ratio", "speakers-count", "speaker-lines"]);

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

/** Bloques que el lector construye de verdad: 3 frases seguidas. */
function blocks(text: string): string[] {
  const sent = text.replace(/\n+/g, " ").split(/(?<=[.!?»])\s+/).filter((s) => s.trim());
  const out: string[] = [];
  for (let i = 0; i < sent.length; i += 3) out.push(sent.slice(i, i + 3).join(" "));
  return out;
}

const SENSES: Record<string, RegExp> = {
  olor: /\b(huele|olor|olía|perfume|aroma)\b/i,
  luz: /\b(luz|sol|sombra|oscur\w+|brilla|a oscuras)\b/i,
  sonido: /\b(ruido|suena|se oye|se oyen|grita|música|charanga)\b/i,
  temperatura: /\b(fr[íi]o?|fr[íi]a|calor|caliente|templad\w+)\b/i,
  tacto: /\b(mojad\w+|h[úu]med\w+|duro|suave|áspero|pegajos\w+)\b/i,
  sabor: /\b(dulce|salad\w+|amarg[oa]|ácid\w+|sabe a)\b/i,
};

function summarize(d: { title: string; arcType: string | null; vocab: unknown; text: string }): ExistingStorySummary {
  const names = new Set<string>();
  for (const line of d.text.split(/\r?\n/)) {
    const m = line.match(/^([A-ZÁÉÍÓÚÑ][a-záéíóúñü]+):\s/);
    if (m) names.add(m[1]);
  }
  for (const n of extractProperNouns(d.text)) names.add(n);
  const firstPara = d.text.split(/\n{2,}/)[0] ?? "";
  return {
    title: d.title,
    arcType: d.arcType,
    vocabLemmas: ((d.vocab as { word: string }[]) ?? []).map((v) => v.word),
    characterNames: [...names],
    openingFirstSentence: (firstPara.split(/(?<=[.!?])\s/)[0] ?? firstPara).trim(),
    motifTags: extractStoryMotifs(d.text),
  };
}

void (async () => {
  const journeyId = process.argv[2];
  if (!journeyId) { console.error("uso: _auditA1.ts <journeyId>"); process.exit(1); }

  const rows = await prisma.journeyStory.findMany({
    where: { journeyId },
    select: { topic: true, slotIndex: true, title: true, synopsis: true, text: true, vocab: true, arcType: true },
  });
  rows.sort((a, b) =>
    TOPIC_ORDER.indexOf(a.topic ?? "") - TOPIC_ORDER.indexOf(b.topic ?? "") ||
    (a.slotIndex ?? 0) - (b.slotIndex ?? 0));

  const allTitles = rows.map((r) => r.title ?? "");
  const out: string[] = [];
  let priorTopic = "";
  let priors: ExistingStorySummary[] = [];

  for (const r of rows) {
    if (r.topic !== priorTopic) { priors = []; priorTopic = r.topic ?? ""; }
    const text = r.text ?? "";
    const vocab = (r.vocab as { word: string; surface?: string }[]) ?? [];

    const res = await validateGeneratedStory(
      { title: r.title, synopsis: r.synopsis, text, vocab, arcType: r.arcType } as never,
      {
        language: "ES", level: "a1", variant: "spain", topic: r.topic ?? undefined,
        journeyTitles: allTitles.filter((t) => t !== r.title),
        existing: [...priors],
      },
    );
    priors.push(summarize({ title: r.title ?? "", arcType: r.arcType, vocab, text }));

    const fails = res.checks.filter((c) => c.status === "fail" && !NARRATOR_EXEMPT.has(c.id));
    const warns = res.checks.filter((c) => c.status === "warn" && !c.id.startsWith("narrator-exempt"));
    const passes = res.checks.filter((c) => c.status === "pass").length;

    const paras = text.split(/\n{2,}/);
    const perPara = paras.map((p) => p.split(/(?<=[.!?»])\s+/).filter((s) => s.trim()).length);
    const B = blocks(text);
    const per = B.map((b) => vocab.filter((v) => b.toLowerCase().includes((v.surface ?? v.word).toLowerCase())).length);
    const missing = vocab.filter((v) => {
      const needle = (v.surface ?? v.word).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return !new RegExp(`(^|[^\\p{L}\\p{M}])${needle}([^\\p{L}\\p{M}]|$)`, "iu").test(text);
    }).length;
    const q = quotedStats(text);
    const senses = Object.entries(SENSES).filter(([, re]) => re.test(text)).map(([k]) => k);

    out.push([
      r.topic, r.slotIndex, r.title, r.arcType,
      words(text),
      `${paras.length}x${[...new Set(perPara)].join("/")}`,
      vocab.length,
      `${vocab.length - missing}/${vocab.length}`,
      `${q.pct.toFixed(0)}%`,
      `${Math.max(...per)}/${vocab.length}`,
      senses.join("+") || "NINGUNA",
      `${passes}p ${warns.length}w ${fails.length}f`,
      fails.length === 0 ? "VERDE" : fails.map((f) => f.id).join(","),
    ].join(" | "));
  }
  console.log(out.join("\n"));

  const lem = rows.flatMap((r) => ((r.vocab as { word: string }[]) ?? []).map((v) => v.word.toLowerCase()));
  console.log(`\n${rows.length} historias · ${lem.length} items · ${new Set(lem).size} lemas únicos`);
  await prisma.$disconnect();
})();
