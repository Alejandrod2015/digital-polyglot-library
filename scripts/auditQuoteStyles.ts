/**
 * Audita QUÉ ESTILO DE COMILLAS usa cada journey, para saber dónde el corpus se
 * contradice a sí mismo (un alumno que lee las 21 historias de un journey no
 * debería ver tres convenciones). Solo mide: no escribe nada.
 *
 *   npx tsx scripts/auditQuoteStyles.ts [--md] [--stories]
 *
 * Estilos que aparecen de verdad en el corpus: angulares «», bajas alemanas
 * „…", inglesas “”, rectas "" y las angulares INVERTIDAS »…« (la convención
 * alemana). La extracción va por orden y BORRA cada estilo antes de pasar al
 * siguiente, como en scripts/_quotedRatio.ts, y el orden no es decorativo:
 *
 *   1. «…» antes que »…«, porque en «hola» «adiós» el » « del medio matchea
 *      como una falsa pareja invertida si se mira primero.
 *   2. „…" antes que las rectas, porque las bajas alemanas CIERRAN con la
 *      recta ASCII (118/118 en este corpus); si no, cada „…" contaría además
 *      como media pareja recta.
 *   3. Las rectas al final: el mismo carácter abre y cierra, así que solo se
 *      pueden emparejar por posición y una suelta impar es una huérfana.
 *
 * Las historias en formato diálogo (líneas "Nombre: ...") no llevan comillas
 * por diseño, así que se cuentan aparte para no leer su 0 como un dato.
 *
 * REGLA DEL PROYECTO: solo journeys `active` (live) y `draft`. Los `archived`
 * ni se leen ni se cuentan.
 */
import { config } from "dotenv"; config({ path: ".env", quiet: true }); config({ path: ".env.local", quiet: true });
import { PrismaClient } from "../src/generated/prisma";

const p = new PrismaClient();

export type StyleKey = "angulares" | "invertidas" | "alemanas" | "inglesas" | "rectas";

const LABEL: Record<StyleKey, string> = {
  angulares: "«»", invertidas: "»«", alemanas: "„\"", inglesas: "“”", rectas: '""',
};
const KEYS = Object.keys(LABEL) as StyleKey[];
const zero = () => ({ angulares: 0, invertidas: 0, alemanas: 0, inglesas: 0, rectas: 0 } as Record<StyleKey, number>);

/** Línea de diálogo con etiqueta de hablante: "Nadia: ...". */
const DIALOGUE_LINE = /^[A-ZÁÉÍÓÚÑÄÖÜ][\wÀ-ÿ]{1,14}:\s/;
export const isDialogueFormat = (text: string) =>
  text.split("\n").filter((l) => DIALOGUE_LINE.test(l)).length >= 5;

/** Parejas por estilo + comillas huérfanas (señal de texto roto). */
export function quoteStyleStats(text: string) {
  let rest = text;
  const pairs = zero();

  // Estilos con carácter distinto para abrir y cerrar: se emparejan solos.
  const paired: [StyleKey, RegExp][] = [
    ["angulares", /«[^»«]*»/g],
    ["invertidas", /»[^«»]*«/g],
    ["alemanas", /„[^"„]*"/g],
    ["inglesas", /“[^”“]*”/g],
  ];
  for (const [key, re] of paired) {
    pairs[key] = (rest.match(re) || []).length;
    rest = rest.replace(re, " ");
  }

  // Rectas: mismo carácter abre y cierra, se emparejan por posición.
  const straight = (rest.match(/"/g) || []).length;
  pairs.rectas = Math.floor(straight / 2);

  // Huérfanas: lo que quedó suelto tras borrar todas las parejas.
  const orphans: Record<string, number> = {};
  for (const c of ["«", "»", "„", "“", "”"]) {
    const n = (rest.match(new RegExp(c, "g")) || []).length;
    if (n) orphans[c] = n;
  }
  if (straight % 2 === 1) orphans['"'] = 1;

  const total = KEYS.reduce((a, k) => a + pairs[k], 0);
  return { pairs, orphans, total, orphanCount: Object.values(orphans).reduce((a, b) => a + b, 0) };
}

/**
 * Presencia REAL: al menos 2 parejas Y al menos el 5% de las citas del journey.
 * Una comilla suelta de otro estilo en 21 historias no es "mezclar".
 */
const isPresent = (n: number, total: number) => n >= 2 && n / total >= 0.05;

(async () => {
  const journeys = await p.journey.findMany({
    where: { status: { in: ["active", "draft"] } },
    select: {
      id: true, name: true, language: true, variant: true, levels: true, status: true,
      stories: { where: { text: { not: null } }, select: { slug: true, level: true, text: true } },
    },
    orderBy: [{ language: "asc" }, { variant: "asc" }, { name: "asc" }],
  });

  const rows = journeys.map((j) => {
    const pairs = zero();
    const storiesWith = zero();
    const orphans: Record<string, number> = {};
    const broken: string[] = [];
    const perStory: { slug: string; dominant: string }[] = [];
    let dialogue = 0;

    for (const s of j.stories) {
      const st = quoteStyleStats(s.text!);
      if (isDialogueFormat(s.text!)) dialogue++;
      for (const k of KEYS) { pairs[k] += st.pairs[k]; if (st.pairs[k] > 0) storiesWith[k]++; }
      for (const [c, n] of Object.entries(st.orphans)) orphans[c] = (orphans[c] || 0) + n;
      if (st.orphanCount) broken.push(`${s.slug ?? "(sin slug)"} → ${Object.entries(st.orphans).map(([c, n]) => `${n}×${c}`).join(", ")}`);
      const dom = KEYS.slice().sort((a, b) => st.pairs[b] - st.pairs[a])[0];
      perStory.push({ slug: s.slug ?? "(sin slug)", dominant: st.total ? LABEL[dom] : "-" });
    }

    const total = KEYS.reduce((a, k) => a + pairs[k], 0);
    const ranked = KEYS.slice().sort((a, b) => pairs[b] - pairs[a]);
    const present = ranked.filter((k) => isPresent(pairs[k], total));
    return {
      j, total, pairs, storiesWith, orphans, broken, perStory, dialogue,
      dominant: total ? ranked[0] : null,
      share: total ? pairs[ranked[0]] / total : 0,
      present, mixes: present.length > 1,
      levels: [...new Set(j.stories.map((s) => s.level))].sort().join("/") || j.levels.join("/"),
    };
  });

  const styleLabel = (k: StyleKey | null) => (k ? LABEL[k] : "-");
  const counts = (r: (typeof rows)[number]) =>
    KEYS.filter((k) => r.pairs[k] > 0).sort((a, b) => r.pairs[b] - r.pairs[a])
      .map((k) => `${LABEL[k]} ${r.pairs[k]} (${r.storiesWith[k]}h)`).join(" · ") || "sin citas";
  const format = (r: (typeof rows)[number]) =>
    r.dialogue === 0 ? "narración" : r.dialogue === r.j.stories.length ? "diálogo" : `mixto (${r.dialogue} diálogo)`;

  if (process.argv.includes("--md")) {
    console.log("| Journey | Idioma/variante | Nivel | Estado | Historias | Formato | Dominante | Recuento por estilo | ¿Mezcla? |");
    console.log("|---|---|---|---|---:|---|---|---|---|");
    for (const r of rows) {
      console.log(`| ${r.j.name} | ${r.j.language}/${r.j.variant} | ${r.levels} | ${r.j.status === "active" ? "live" : "draft"} | ${r.j.stories.length} | ${format(r)} | ${styleLabel(r.dominant)}${r.dominant ? ` ${(r.share * 100).toFixed(0)}%` : ""} | ${counts(r)} | ${r.mixes ? `**sí** - ${r.present.map(styleLabel).join(" + ")}` : "no"} |`);
    }
  } else {
    for (const r of rows) {
      console.log(`\n${r.j.language}/${r.j.variant} · ${r.levels} · ${r.j.status === "active" ? "live" : "draft"} · ${r.j.name}  [${format(r)}]`);
      console.log(`  ${r.j.stories.length} historias con texto · dominante ${styleLabel(r.dominant)} (${(r.share * 100).toFixed(0)}%)${r.mixes ? `  ** MEZCLA: ${r.present.map(styleLabel).join(" + ")}` : ""}`);
      console.log(`  ${counts(r)}`);
      if (r.broken.length) console.log(`  huérfanas: ${r.broken.join(" · ")}`);
      if (process.argv.includes("--stories")) for (const s of r.perStory) console.log(`    ${s.slug.padEnd(36)} ${s.dominant}`);
    }
  }

  const mixing = rows.filter((r) => r.mixes);
  const broken = rows.filter((r) => r.broken.length);
  console.log(`\n${rows.length} journeys (live + draft) · ${mixing.length} mezclan · ${broken.length} con comillas huérfanas`);
  for (const r of broken) console.log(`  huérfanas en ${r.j.language}/${r.j.variant} "${r.j.name}": ${r.broken.join(" · ")}`);

  const by = (pick: (r: (typeof rows)[number]) => string) => {
    const m: Record<string, Set<string>> = {};
    for (const r of rows) if (r.dominant) (m[pick(r)] ||= new Set()).add(LABEL[r.dominant]);
    return Object.entries(m).map(([k, v]) => `${k}: ${[...v].join(", ")}`).join(" | ");
  };
  console.log(`por idioma → ${by((r) => r.j.language)}`);
  console.log(`por nivel  → ${by((r) => r.levels)}`);
})().finally(() => p.$disconnect());
