/**
 * La misma escalera, medida de dos maneras, para saber cuanto del numero es
 * recirculacion de verdad y cuanto es la MISMA palabra ocupando varias plazas.
 *
 *   por plaza    = lo que mide el gate hoy
 *   por palabra  = una sola cuenta por lema distinto (neutraliza el re-ensenar)
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
const tok = (t: string) => (t.toLowerCase().match(/\p{L}+/gu) ?? []);
const clave = (v: { word: string; surface?: string | null }) =>
  String(v.surface ?? v.word).toLowerCase().replace(/^(der|die|das|le|la|el|il|o|a)\s+/, "");
(async () => {
  const js = await p.journey.findMany({ where: { status: { not: "archived" } } });
  console.log("nivel  porPlaza  porPalabra  plazas/palabra  journey");
  const filas: Array<[string, number, number, number, string]> = [];
  for (const j of js as never as Array<Record<string, unknown>>) {
    const rows = await p.journeyStory.findMany({ where: { journeyId: j.id as string }, select: { text: true, vocab: true } });
    const con = rows.filter((r) => String(r.text ?? "").trim());
    if (con.length < 7) continue;
    const cuerpos = con.map((r) => new Set(tok(String(r.text ?? ""))));
    const enc: number[] = []; const porClave = new Map<string, number>();
    for (const r of con) for (const v of ((r.vocab as Array<{word:string;surface?:string}> ?? []))) {
      const k = clave(v); const n = cuerpos.filter((c) => c.has(k)).length;
      enc.push(n); porClave.set(k, n);
    }
    if (!enc.length) continue;
    const porPlaza = enc.reduce((a, b) => a + b, 0) / enc.length;
    const vals = [...porClave.values()];
    const porPalabra = vals.reduce((a, b) => a + b, 0) / vals.length;
    filas.push([((j.levels as string[]) ?? []).join("+").toUpperCase(), porPlaza, porPalabra,
      enc.length / vals.length, `${j.name}/${j.language}/${j.variant}`]);
  }
  filas.sort((a, b) => a[0].localeCompare(b[0]) || b[1] - a[1]);
  for (const f of filas)
    console.log(`${f[0].padEnd(6)} ${f[1].toFixed(2).padStart(8)} ${f[2].toFixed(2).padStart(11)} ${f[3].toFixed(2).padStart(15)}  ${f[4]}`);
})().finally(() => p.$disconnect());
