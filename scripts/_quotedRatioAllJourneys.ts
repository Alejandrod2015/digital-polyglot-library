/**
 * Porcentaje de habla citada en TODOS los journeys de estilo narrador.
 *
 * Estilo narrador = las historias del journey usan UNA sola voz: o no tienen
 * dialogueSpec, o su dialogueSpec asigna un único voiceId distinto. La columna
 * "Estilo" de journeysTable.ts no sirve aquí porque marca multivoz en cuanto
 * hay `cast` o `dialogueSpec`, aunque la narre una sola voz.
 *
 * Solo journeys live (active) + draft; NUNCA archived.
 *
 *   npx tsx scripts/_quotedRatioAllJourneys.ts [--json]
 */
import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import { PrismaClient } from "../src/generated/prisma";
import { quotedStats } from "./_quotedRatio";

const p = new PrismaClient();

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

/**
 * El corpus no usa un solo estilo de comillas: angulares «» (ES), bajas
 * alemanas „…" (el journey alemán A0 cierra con la recta ASCII), curvas “”
 * (parte de Colombia) y rectas "" . Se extraen EN ESTE ORDEN y cada cita
 * encontrada se borra del cuerpo antes de pasar al siguiente estilo, porque
 * si no la recta ASCII se emparejaría con el cierre de una cita alemana y
 * mediría el texto que hay ENTRE dos citas en vez de la cita.
 */
const STYLES: Array<[string, RegExp]> = [
  ["ang", /«[^»]*»/g],          // «...»
  ["de", /„[^„“”"]*["“”]/g],    // „..."  /  „...“
  ["curly", /“[^“”]*”/g],       // “...”
  ["straight", /"[^"\n]*"/g],   // "..."
];

/** Palabras citadas y nº de citas, sumando los cuatro estilos. */
function combinedStats(text: string) {
  let rest = text;
  let quotes = 0, inside = 0;
  const byStyle: Record<string, number> = {};
  for (const [name, re] of STYLES) {
    const found = rest.match(re) ?? [];
    byStyle[name] = found.length;
    quotes += found.length;
    inside += found.reduce((n, q) => n + words(q.replace(/[«»„“”"]/g, "")), 0);
    rest = rest.replace(re, " "); // fuera del cuerpo para el siguiente estilo
  }
  const total = quotedStats(text).total; // mismo recuento de palabras que la métrica base
  return { quotes, inside, total, pct: total ? (inside / total) * 100 : 0, byStyle };
}

/** Voces distintas declaradas en el dialogueSpec (0 si no hay spec). */
function distinctVoices(spec: unknown): number {
  if (!Array.isArray(spec)) return 0;
  const ids = new Set<string>();
  for (const seg of spec as Array<Record<string, unknown>>) {
    const v = seg?.voice ?? seg?.voiceId ?? seg?.voice_id;
    if (typeof v === "string" && v.trim()) ids.add(v.trim());
  }
  return ids.size;
}

async function main() {
  const js = await p.journey.findMany({
    where: { status: { in: ["active", "draft"] } }, // live + draft; NUNCA archived
    select: {
      id: true, name: true, language: true, variant: true, status: true, levels: true,
      stories: { select: { slug: true, title: true, text: true, dialogueSpec: true } },
    },
    orderBy: [{ language: "asc" }, { name: "asc" }],
  });

  type Row = {
    name: string; lang: string; level: string; status: string;
    n: number; pct: number; min: number; max: number;
    qPer: number; mudas: number; voices: string;
  };
  const rows: Row[] = [];
  const skipped: string[] = [];
  const corpusStyles: Record<string, number> = {};

  for (const j of js) {
    const withText = j.stories.filter((s) => (s.text ?? "").trim().length > 0);
    const voiceCounts = withText.map((s) => distinctVoices(s.dialogueSpec));
    const maxVoices = voiceCounts.length ? Math.max(...voiceCounts) : 0;
    const label = `${j.name} (${j.language}/${j.variant})`;
    if (withText.length === 0) { skipped.push(`${label}: sin historias con texto`); continue; }
    if (maxVoices > 1) { skipped.push(`${label}: multivoz (hasta ${maxVoices} voces distintas)`); continue; }

    const stats = withText.map((s) => ({ slug: s.slug, ...combinedStats(s.text!) }));
    stats.forEach((s) => {
      for (const [k, v] of Object.entries(s.byStyle)) corpusStyles[k] = (corpusStyles[k] ?? 0) + v;
    });
    const inside = stats.reduce((n, s) => n + s.inside, 0);
    const total = stats.reduce((n, s) => n + s.total, 0);
    const pcts = stats.map((s) => s.pct);
    rows.push({
      name: j.name,
      lang: `${j.language}/${j.variant}`,
      level: j.levels.join("/") || "-",
      status: j.status === "active" ? "LIVE" : "DRAFT",
      n: withText.length,
      pct: total ? (inside / total) * 100 : 0,
      min: Math.min(...pcts), max: Math.max(...pcts),
      qPer: stats.reduce((n, s) => n + s.quotes, 0) / withText.length,
      mudas: stats.filter((s) => s.quotes === 0).length,
      voices: maxVoices === 0 ? "sin spec" : "1 voz",
    });

    if (process.argv.includes("--detail")) {
      for (const s of stats) console.log(`   ${label} · ${s.slug.padEnd(34)} ${s.pct.toFixed(0).padStart(3)}% · ${s.quotes} citas ${JSON.stringify(s.byStyle)}`);
    }
  }

  rows.sort((a, b) => b.pct - a.pct);
  console.log(`\nEstilo de comillas en el corpus narrador: ${JSON.stringify(corpusStyles)}\n`);
  console.log("Estado|Journey|Idioma/Var|Nivel|Hist|%citado|Rango|Citas/hist|Mudas|Voces");
  for (const r of rows) {
    console.log(`${r.status}|${r.name}|${r.lang}|${r.level}|${r.n}|${r.pct.toFixed(1)}|${r.min.toFixed(0)}-${r.max.toFixed(0)}|${r.qPer.toFixed(1)}|${r.mudas}/${r.n}|${r.voices}`);
  }
  console.log("\nExcluidos (no narrador o sin texto):");
  for (const s of skipped) console.log(`  - ${s}`);
  await p.$disconnect();
}

main().catch(async (e) => { console.error(e); await p.$disconnect(); process.exit(1); });
