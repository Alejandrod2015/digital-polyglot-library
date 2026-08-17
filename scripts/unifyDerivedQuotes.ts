/**
 * Pasa a comillas inglesas “ ” las COPIAS DERIVADAS del texto de una historia:
 * `audioSegments` (segmentación que acompaña al audio) y `dialogueSpec` (el
 * reparto de voces). Son copias congeladas que no se regeneran al editar
 * `text`, así que se quedan con las comillas viejas.
 *
 *   npx tsx scripts/unifyDerivedQuotes.ts --all [--apply]
 *
 * Recorre el JSON y sustituye SOLO dentro de los valores string, dejando
 * intactas las claves y los números (tiempos, offsets). El swap es 1:1 en
 * caracteres, así que ningún valor cambia de longitud; el script lo verifica
 * y aborta si alguno lo hace.
 *
 * NO toca `vocab`: ese campo está detrás del gate de historias y va por
 * scripts/saveStory.ts --typography-only.
 */
import { config } from "dotenv"; config({ path: ".env", quiet: true }); config({ path: ".env.local", quiet: true });
import { PrismaClient } from "../src/generated/prisma";

const p = new PrismaClient();
const LQ = "“", RQ = "”";

function toCurly(s: string): string {
  let out = s
    .replace(/«([^»«]*)»/g, (_m, i) => LQ + i + RQ)
    .replace(/»([^«»]*)«/g, (_m, i) => LQ + i + RQ)
    .replace(/„([^"„]*)"/g, (_m, i) => LQ + i + RQ);
  // Comillas SIMPLES en par: solo son comillas si la apertura no va pegada a
  // una letra (pegada = elisión: pa', un po', de' Fiori, geht's).
  out = out.replace(/(^|[^\p{L}\p{N}])'([^'\n]{2,70})'/gu, (_m, pre, inner) => `${pre}${LQ}${inner}${RQ}`);
  const straight = (out.match(/"/g) || []).length;
  if (straight > 0 && straight % 2 === 0) {
    let open = true;
    out = out.replace(/"/g, () => { const c = open ? LQ : RQ; open = !open; return c; });
  }

  // HUÉRFANAS. En `audioSegments` el cuerpo va partido en trozos, así que una
  // cita puede empezar en un segmento («Porque es simple.) y cerrar en el
  // siguiente (…la montaña.»). Cada trozo queda con una comilla sin pareja,
  // que el emparejado de arriba no puede resolver. Se decide por el vecino de
  // la derecha: si empieza palabra, abre; si no, cierra. Esto vale igual para
  // las angulares españolas («…») y para las alemanas invertidas (»…«), donde
  // el mismo carácter juega el papel contrario.
  out = out.replace(/[«»„"]/g, (ch, i: number) => {
    const next = out[i + 1] ?? "";
    return /[\p{L}\p{N}¿¡]/u.test(next) ? LQ : RQ;
  });
  return out;
}

/** Sustituye solo en los valores string; claves y números quedan igual. */
function walk(v: any, stats: { changed: number }): any {
  if (typeof v === "string") {
    const out = toCurly(v);
    if (out !== v) {
      if (out.length !== v.length) throw new Error(`cambio de longitud: ${JSON.stringify(v).slice(0, 80)}`);
      stats.changed++;
    }
    return out;
  }
  if (Array.isArray(v)) return v.map((x) => walk(x, stats));
  if (v && typeof v === "object") {
    const o: Record<string, any> = {};
    for (const [k, val] of Object.entries(v)) o[k] = walk(val, stats);
    return o;
  }
  return v;
}

(async () => {
  const apply = process.argv.includes("--apply");
  if (!process.argv.includes("--all")) { console.error("usage: --all [--apply]"); process.exit(2); }

  const rows = await p.journeyStory.findMany({
    where: { journey: { is: { status: { in: ["active", "draft"] } } } },
    orderBy: { slug: "asc" },
    select: { id: true, slug: true, dialogueSpec: true, audioSegments: true },
  });

  let seg = 0, dlg = 0, strings = 0;
  for (const r of rows) {
    const data: Record<string, any> = {};
    for (const campo of ["audioSegments", "dialogueSpec"] as const) {
      const val = (r as any)[campo];
      if (!val) continue;
      const stats = { changed: 0 };
      const out = walk(val, stats);
      if (!stats.changed) continue;
      data[campo] = out;
      strings += stats.changed;
      if (campo === "audioSegments") seg++; else dlg++;
    }
    if (!Object.keys(data).length) continue;
    if (apply) await p.journeyStory.update({ where: { id: r.id }, data });
    console.log(`  ${apply ? "✓" : "·"} ${r.slug} [${Object.keys(data).join(", ")}]`);
  }
  console.log(`\naudioSegments: ${seg} historias · dialogueSpec: ${dlg} historias · ${strings} cadenas${apply ? " actualizadas" : " a actualizar (usa --apply)"}`);
})().finally(() => p.$disconnect());
