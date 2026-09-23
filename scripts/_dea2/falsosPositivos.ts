/**
 * SOLO MIDE. No escribe nada, ni en disco ni en la base.
 *
 * Cuenta las plazas de vocab que el `covers` de `_validateSets.ts` da por
 * ensenadas y en realidad no lo estan. Ese matcher compara por PREFIJO de la
 * cabeza del sintagma (3 letras bastan), y en aleman eso emparejo `der
 * Fussball` con `der Fuss` y `leihen` con `leicht`: dos sets en verde con una
 * plaza sin ejercicio.
 *
 * El criterio, a proposito conservador, porque el prefijo tambien acierta en
 * la flexion legitima (target `olla` para la plaza `ollas`) y contar eso
 * inflaria el numero hasta hacerlo inutil. Una plaza es FALSO POSITIVO cuando:
 *   (a) ningun ejercicio la cubre de forma estricta (lema sin articulo o
 *       superficie exacta), y
 *   (b) todos los ejercicios que la cubren por prefijo ya cubren de forma
 *       estricta OTRA plaza, o sea que ya tienen dueno y le estan robando el
 *       sitio a esta.
 * Asi solo entra la plaza que de verdad se queda sin quien la ensene.
 *
 *   npx tsx scripts/_deA2/falsosPositivos.ts [--lista]
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import * as fs from "fs";
import { PrismaClient } from "../../src/generated/prisma";

const DIR = "scripts/_sets";
const p = new PrismaClient();

const norm = (s: string) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
const ART = /^(der|die|das|den|dem|des|ein|eine|le|la|les|l|el|los|las|il|lo|gli|un|une|o|a|os|as)$/;
const firstTok = (s: string) => {
  const t = norm(s).split(/\s+/).filter(Boolean);
  if (!t.length) return "";
  return t.length > 1 && ART.test(t[0]) ? t[t.length - 1] : t[0];
};
/** El de `_validateSets.ts`, copiado tal cual para medir contra el de verdad. */
function coversLoose(target: string, word: string, surface?: string) {
  const a = norm(target), b = norm(word);
  if (!a || !b) return false;
  if (a === b) return true;
  if (surface && a === norm(surface)) return true;
  const ta = firstTok(a), tb = firstTok(b);
  let i = 0; while (i < ta.length && i < tb.length && ta[i] === tb[i]) i++;
  return i >= Math.max(3, Math.min(ta.length, tb.length) - 3);
}
function coversStrict(target: string, word: string, surface?: string) {
  const a = norm(target);
  return a === norm(word) || a === firstTok(word) || (!!surface && a === norm(surface));
}

(async () => {
  const lista = process.argv.includes("--lista");
  const ficheros = fs.readdirSync(DIR).filter((f) => f.endsWith(".json")).sort();
  const slugs = ficheros.map((f) => f.replace(".json", ""));

  const rows = await p.journeyStory.findMany({
    where: { slug: { in: slugs } },
    select: { slug: true, vocab: true, journey: { select: { id: true, name: true, language: true, variant: true, levels: true, status: true } } },
  });
  const porSlug = new Map(rows.map((r) => [r.slug!, r]));

  let setsAfectados = 0, plazasAfectadas = 0, setsMedidos = 0, sinHistoria = 0;
  const journeys = new Map<string, { etiqueta: string; status: string; sets: Set<string>; plazas: number }>();
  const detalle: string[] = [];

  for (const f of ficheros) {
    const slug = f.replace(".json", "");
    const r = porSlug.get(slug);
    if (!r || !r.journey) { sinHistoria++; continue; }
    // Los archivados no cuentan.
    if (r.journey.status !== "active" && r.journey.status !== "draft") continue;
    const voc = ((r.vocab as any[]) ?? []).filter((v) => v?.word);
    if (!voc.length) continue;
    setsMedidos++;

    const exs = JSON.parse(fs.readFileSync(`${DIR}/${f}`, "utf8")) as any[];
    const targets: string[] = [];
    for (const e of exs) {
      if (e?.type === "match_meaning") for (const pr of e.payload?.pairs ?? []) targets.push(pr.word);
      else if (e?.word) targets.push(e.word);
    }
    // Que plaza cubre estrictamente cada ejercicio: el que ya tiene dueno.
    const dueno = new Map<string, string[]>();
    for (const t of targets) {
      const suyas = voc.filter((v) => coversStrict(t, v.word, v.surface)).map((v) => String(v.word));
      dueno.set(t, suyas);
    }
    const falsas: string[] = [];
    for (const v of voc) {
      if (targets.some((t) => coversStrict(t, v.word, v.surface))) continue;
      const porPrefijo = targets.filter((t) => coversLoose(t, v.word, v.surface));
      if (!porPrefijo.length) continue;                       // hueco que el gate YA canta
      if (!porPrefijo.every((t) => (dueno.get(t) ?? []).length)) continue; // el prefijo puede ser su flexion
      falsas.push(`${v.word} <- ${porPrefijo.join(", ")}`);
    }
    if (!falsas.length) continue;
    setsAfectados++; plazasAfectadas += falsas.length;
    const j = r.journey;
    const et = `${j.language}/${j.variant} ${j.name} ${(j.levels ?? []).join(",")}`;
    const reg = journeys.get(j.id) ?? { etiqueta: et, status: j.status, sets: new Set<string>(), plazas: 0 };
    reg.sets.add(slug); reg.plazas += falsas.length; journeys.set(j.id, reg);
    if (lista) detalle.push(`  ${slug}: ${falsas.join(" · ")}`);
  }

  const live = [...journeys.values()].filter((j) => j.status === "active");
  const draft = [...journeys.values()].filter((j) => j.status === "draft");
  console.log(`sets medidos: ${setsMedidos} de ${ficheros.length} ficheros` + (sinHistoria ? ` (${sinHistoria} sin historia en la base)` : ""));
  console.log(`\nSETS AFECTADOS:    ${setsAfectados}`);
  console.log(`PLAZAS AFECTADAS:  ${plazasAfectadas}`);
  console.log(`JOURNEYS:          ${journeys.size}  (${live.length} publicados, ${draft.length} borradores)`);
  const fila = (j: { etiqueta: string; sets: Set<string>; plazas: number }) =>
    `  ${j.etiqueta.padEnd(42)} ${String(j.sets.size).padStart(3)} sets · ${String(j.plazas).padStart(3)} plazas`;
  if (live.length) { console.log(`\npublicados:`); for (const j of live.sort((a,b)=>b.plazas-a.plazas)) console.log(fila(j)); }
  if (draft.length) { console.log(`\nborradores:`); for (const j of draft.sort((a,b)=>b.plazas-a.plazas)) console.log(fila(j)); }
  if (lista) { console.log(`\ndetalle:`); for (const d of detalle) console.log(d); }
  await p.$disconnect();
})();
