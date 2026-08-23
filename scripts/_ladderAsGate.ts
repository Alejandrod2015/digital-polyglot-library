/**
 * La recirculación medida EXACTAMENTE como la mide el gate
 * (`journey-vocab-recirculation` en `src/lib/validateJourneyStories.ts`):
 * clave = `surface ?? word` en minúsculas, sin el artículo inicial simple, y
 * se busca esa cadena como TOKEN suelto en los cuerpos.
 *
 * Sirve para comparar journeys con la misma vara antes de reescribir nada:
 * tres medidores distintos daban tres cifras distintas del mismo journey.
 *
 *   npx tsx scripts/_ladderAsGate.ts <journeyId> [...más ids]
 */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();

const tok = (t: string) => (t.toLowerCase().match(/\p{L}+/gu) ?? []);
const clave = (v: { word: string; surface?: string | null }) =>
  String(v.surface ?? v.word).toLowerCase().replace(/^(der|die|das|le|la|el|il|o|a)\s+/, "");

/** Simulación: qué daría el gate si cada clave de varias palabras se redujera
 *  a su última palabra (que es la de contenido en francés y español). No toca
 *  la base; solo dice si el problema es de surfaces o de texto. */
const SIMULAR = process.argv.includes("--simular");
const reduce = (k: string) => (SIMULAR && /\s/.test(k) ? k.split(/\s+/).pop()! : k);

/** `--check <json>`: mide un lote candidato con la vara del gate, mezclándolo
 *  con lo que ya está en la base. Sin esto hay que guardar para saber si sube,
 *  y el gate es todo o nada. */
const CI = process.argv.indexOf("--check");

async function main() {
  for (const id of process.argv.slice(2).filter((x) => !x.startsWith("--") && x !== (CI > 0 ? process.argv[CI + 1] : ""))) {
    const j = await p.journey.findUnique({ where: { id }, select: { name: true, language: true, variant: true, levels: true } });
    const base = await p.journeyStory.findMany({ where: { journeyId: id, text: { not: null } }, select: { topic: true, slotIndex: true, text: true, vocab: true } });
    let st: Array<{ text: string | null; vocab: unknown }> = base;
    if (CI > 0) {
      const cand = JSON.parse(require("fs").readFileSync(process.argv[CI + 1], "utf8")) as Array<{ topic: string; slotIndex: number; text: string; vocab: unknown }>;
      const k = new Map(cand.map((c) => [`${c.topic}#${c.slotIndex}`, c]));
      st = base.map((b) => k.get(`${b.topic}#${b.slotIndex}`) ?? b);
    }
    const cuerpos = st.map((s) => new Set(tok(s.text!)));
    const enc: number[] = [];
    let multi = 0;
    for (const s of st) for (const v of ((s.vocab as Array<{ word: string; surface?: string }>) ?? [])) {
      const k = reduce(clave(v));
      if (/\s/.test(k)) multi++;              // clave de varias palabras: nunca casa un token suelto
      enc.push(cuerpos.filter((c) => c.has(k)).length);
    }
    const media = enc.reduce((a, b) => a + b, 0) / (enc.length || 1);
    const unaVez = enc.filter((n) => n <= 1).length;
    console.log(
      `${(j?.name ?? id).padEnd(10)} ${j?.language}/${j?.variant} ${j?.levels.join("/")}: ` +
      `media ${media.toFixed(2)} · ${unaVez}/${enc.length} una sola vez · ` +
      `${multi} claves de varias palabras (imposibles de casar)`
    );
  }
  await p.$disconnect();
}
main();
