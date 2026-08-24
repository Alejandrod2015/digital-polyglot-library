/** La cola medida de las DOS formas: contando todas las plazas (lo que hace
 *  hoy el gate) y con tope de dos plazas por palabra (como se calibró el 30%). */
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const tok = (t: string) => (t.toLowerCase().match(/\p{L}+/gu) ?? []);
(async () => {
  const js = await p.journey.findMany({ where: { status: { in: ["active", "draft"] } }, select: { id: true, name: true, language: true, variant: true, levels: true, status: true } });
  const filas: Array<[string, string, string, number, number]> = [];
  for (const j of js) {
    const rows = await p.journeyStory.findMany({ where: { journeyId: j.id }, select: { text: true, vocab: true } });
    if (rows.length < 7) continue;
    const cuerpos = rows.map((s) => new Set(tok(s.text ?? "")));
    const todas: Array<{ k: string; n: number; anchor: boolean }> = [];
    for (const s of rows) for (const v of ((s.vocab as Array<{ word: string; surface?: string; anchor?: boolean }>) ?? [])) {
      const k = String(v.surface ?? v.word).toLowerCase();
      todas.push({ k, n: cuerpos.filter((c) => c.has(k)).length, anchor: Boolean(v.anchor) });
    }
    if (!todas.length) continue;
    const port = todas.some((x) => x.anchor) ? todas.filter((x) => !x.anchor) : todas;
    const cola = (xs: typeof port) => xs.filter((x) => x.n <= 1).length / xs.length;
    const vistas = new Map<string, number>();
    const topeDos = port.filter((x) => {
      const c = (vistas.get(x.k) ?? 0) + 1; vistas.set(x.k, c); return c <= 2;
    });
    filas.push([`${j.name} ${j.language}/${j.variant} ${(j.levels ?? []).join("")}`, j.status, (j.levels ?? [])[0] ?? "?", Math.round(cola(port) * 100), Math.round(cola(topeDos) * 100)]);
  }
  filas.sort((a, b) => (a[2] + a[1]).localeCompare(b[2] + b[1]));
  console.log("journey".padEnd(42) + "estado  nivel  cola(todas)  cola(tope 2)");
  for (const f of filas) console.log(`${f[0].padEnd(42)}${f[1].padEnd(8)}${f[2].padEnd(7)}${String(f[3]).padStart(8)}%${String(f[4]).padStart(12)}%`);
  await p.$disconnect();
})();
