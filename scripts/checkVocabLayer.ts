/**
 * lint:vocab-layer. Una plaza de vocab es una entrada de glosa con etiqueta:
 * las unicas diferencias son el badge, el estilo del panel y el resaltado.
 * La regla vive en docs/story-quality-spec.md §4; aqui solo se comprueba.
 *
 * Caza tres cosas:
 *   1. plaza sin frase de contexto (`c`), o sea la tarjeta repite la definicion
 *   2. verbo sin tabla de formas (`f`) y sin el infinitivo entre parentesis
 *   3. `surface` que falta cuando la forma del cuerpo no es el lema
 *
 * Run: npm run lint:vocab-layer
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import * as fs from "node:fs";
import { PrismaClient } from "../src/generated/prisma";

/** Bundles que ya viven bajo la regla. Los demas solo se cuentan. */
const BAJO_LA_REGLA: string[] = JSON.parse(
  fs.readFileSync("scripts/vocab-layer-bundles.json", "utf8")
).bundles;

type Fallo = { historia: string; palabra: string; que: string };

(async () => {
  const p = new PrismaClient();
  // El bundle de una historia no es una columna: lo declara el `slugs` de la
  // fila global, que es donde se dice a que historias cubre (ver tapGlosses.ts).
  const capas = await p.tapGlossSet.findMany();
  const bundleDe = new Map<string, string>();
  for (const c of capas) if (c.slug === "") for (const sl of c.slugs) bundleDe.set(sl, c.bundle);
  const porBundle = new Map<string, typeof capas>();
  for (const c of capas) porBundle.set(c.bundle, [...(porBundle.get(c.bundle) ?? []), c]);

  const todas = await p.journeyStory.findMany({
    where: { text: { not: "" } },
    select: { slug: true, title: true, text: true, vocab: true },
  });
  // Solo las que tienen capa: una historia sin bundle no ha llegado a este paso.
  const historias = todas
    .filter((h) => h.slug && bundleDe.has(h.slug))
    .map((h) => ({ ...h, glossBundle: bundleDe.get(h.slug!)! }));

  const fallos: Fallo[] = [];
  const deuda: Fallo[] = [];
  let plazas = 0;
  for (const h of historias) {
    const filas = porBundle.get(h.glossBundle!) ?? [];
    const global = (filas.find((f) => f.slug === "")?.glosses ?? {}) as Record<string, any>;
    const propia = (filas.find((f) => f.slug === h.slug)?.glosses ?? {}) as Record<string, any>;
    const capa: Record<string, any> = { ...global, ...propia };
    const cuerpo = `${h.title} ${h.text}`.toLowerCase();

    for (const v of ((h.vocab ?? []) as any[])) {
      plazas++;
      const lema = String(v.word ?? "").trim().toLowerCase();
      const sup = String(v.surface ?? "").trim().toLowerCase();
      if (!lema) continue;
      // 3. la superficie: si el lema no sale literal en el cuerpo, hace falta
      const parte = BAJO_LA_REGLA.includes(h.glossBundle) ? fallos : deuda;
      if (!cuerpo.includes(lema) && !sup) {
        parte.push({ historia: h.slug!, palabra: lema, que: "falta `surface` (el lema no sale en el cuerpo)" });
      }
      // 1. la frase de contexto, buscada como la busca el panel
      const hit = [sup, lema].filter(Boolean).map((k) => capa[k]).find((g) => g?.c);
      if (!hit) {
        parte.push({ historia: h.slug!, palabra: lema, que: "sin frase de contexto" });
        continue;
      }
      // 2. el verbo, con tabla o con el infinitivo a la vista
      // El infinitivo entre parentesis vale con nota detras: los imperativos
      // se glosan "show it, prove it (demostrar, command)", que es la forma
      // que pide la spec y que la version estricta (solo `(demostrar)`) daba
      // por ausente. Lo que se sigue exigiendo es el infinitivo a la vista.
      if (v.type === "verb" && !hit.f && !/\(\p{L}+(?:,[^)]*)?\)/u.test(String(hit.g ?? ""))) {
        parte.push({ historia: h.slug!, palabra: lema, que: "verbo sin tabla de formas ni infinitivo" });
      }
    }
  }
  await p.$disconnect();

  const pendiente = deuda.length
    ? `  (deuda anterior a la regla, fuera de la barrera: ${deuda.length} plazas en ${new Set(deuda.map((d) => d.historia)).size} historias)`
    : "";
  if (!fallos.length) {
    console.log(`vocab-layer: limpio en ${BAJO_LA_REGLA.length} bundle(s) bajo la regla`);
    if (pendiente) console.log(pendiente);
    process.exit(0);
  }
  console.error(`vocab-layer: ${fallos.length} plaza(s) sin la capa de la glosa\n`);
  const porHistoria = new Map<string, Fallo[]>();
  for (const f of fallos) porHistoria.set(f.historia, [...(porHistoria.get(f.historia) ?? []), f]);
  for (const [h, fs] of [...porHistoria].slice(0, 12)) {
    console.error(`  ${h}: ${fs.length}`);
    for (const f of fs.slice(0, 6)) console.error(`     ${f.palabra}: ${f.que}`);
  }
  if (pendiente) console.error(pendiente);
  console.error(`
Un slot de vocab es una glosa con etiqueta. La regla y como se rellena cada
campo estan en docs/story-quality-spec.md §4. Un bundle entra en la barrera
anadiendolo a scripts/vocab-layer-bundles.json, y solo cuando ya la cumple.`);
  process.exit(1);
})();
