/** La escalera de recirculacion en TODO el catalogo, para calibrar el umbral
 *  contra los journeys buenos y no contra un numero inventado. Solo lectura. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const js = await p.journey.findMany({
    where: { status: { not: "archived" } },
    select: { id: true, name: true, language: true, variant: true, levels: true, status: true,
              stories: { select: { text: true, vocab: true } } },
  });
  const tok = (t: string) => (t.toLowerCase().match(/\p{L}+/gu) ?? []);
  const clave = (v: any) => String(v.surface ?? v.word).toLowerCase()
    .replace(/^(der|die|das|le|la|les|el|los|las|il|lo|o|a|os|as|un|une)\s+/, "");
  const filas: Array<{ n: string; media: number; una: number; tot: number }> = [];
  for (const j of js) {
    const con = j.stories.filter((s) => s.text && ((s.vocab as any[]) ?? []).length);
    if (con.length < 10) continue;
    const cuerpos = con.map((s) => new Set(tok(String(s.text))));
    const enc: number[] = [];
    for (const s of con) for (const v of ((s.vocab as any[]) ?? []))
      enc.push(cuerpos.filter((c) => c.has(clave(v))).length);
    if (!enc.length) continue;
    const media = enc.reduce((a, b) => a + b, 0) / enc.length;
    filas.push({ n: `${j.language}/${j.variant} ${j.levels} ${j.name} [${j.status}]`,
                 media, una: enc.filter((n) => n <= 1).length, tot: enc.length });
  }
  filas.sort((a, b) => b.media - a.media);
  for (const f of filas)
    console.log(`${f.media.toFixed(2)}  ${String(Math.round(f.una / f.tot * 100)).padStart(3)}% una sola vez   ${f.n}`);
  await p.$disconnect();
})();
