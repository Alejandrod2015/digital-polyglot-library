import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
async function main() {
  const js = await p.journey.findMany({ where: { status: { not: "archived" } }, select: { id: true, name: true, language: true, variant: true, levels: true, status: true } });
  const out: string[] = [];
  for (const j of js) {
    const rows = await p.journeyStory.findMany({ where: { journeyId: j.id, text: { not: null } }, select: { text: true, vocab: true } });
    if (rows.length < 7) continue;
    const tok = (t: string) => (t.toLowerCase().match(/\p{L}+/gu) ?? []);
    const cuerpos = rows.map((r) => new Set(tok(r.text!)));
    const enc: number[] = [];
    for (const r of rows) for (const v of ((r.vocab as any[]) ?? [])) {
      const k = String(v.surface ?? v.word).toLowerCase().replace(/^(der|die|das|le|la|el|il|o|a)\s+/, "");
      enc.push(cuerpos.filter((c) => c.has(k)).length);
    }
    if (!enc.length) continue;
    const media = enc.reduce((a, b) => a + b, 0) / enc.length;
    out.push(`${(j.levels ?? []).join("/")} ${j.name} ${j.variant} [${j.status}] · ${rows.length} historias · media ${media.toFixed(2)}`);
  }
  out.sort();
  for (const l of out) console.log(l);
  await p.$disconnect();
}
main();
