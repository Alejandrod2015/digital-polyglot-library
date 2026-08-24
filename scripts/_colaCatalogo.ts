import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const tok = (t: string) => (t.toLowerCase().match(/\p{L}+/gu) ?? []);
(async () => {
  const js = await p.journey.findMany({ where: { status: { in: ["active", "draft"] } }, select: { id: true, name: true, language: true, variant: true, levels: true, status: true } });
  for (const j of js) {
    const rows = await p.journeyStory.findMany({ where: { journeyId: j.id }, select: { text: true, vocab: true } });
    if (rows.length < 7) continue;
    const cuerpos = rows.map((s) => new Set(tok(s.text ?? "")));
    const todas: Array<{ n: number; anchor: boolean }> = [];
    for (const s of rows) for (const v of ((s.vocab as Array<{ word: string; surface?: string; anchor?: boolean }>) ?? [])) {
      const k = String(v.surface ?? v.word).toLowerCase();
      todas.push({ n: cuerpos.filter((c) => c.has(k)).length, anchor: Boolean(v.anchor) });
    }
    if (!todas.length) continue;
    const port = todas.some((x) => x.anchor) ? todas.filter((x) => !x.anchor) : todas;
    const una = port.filter((x) => x.n <= 1).length;
    console.log(`${(j.name + " " + j.language + "/" + j.variant + " " + (j.levels ?? []).join("")).padEnd(42)} ${j.status.padEnd(6)} cola ${Math.round((una / port.length) * 100)}%  media ${(port.reduce((a, b) => a + b.n, 0) / port.length).toFixed(2)}`);
  }
  await p.$disconnect();
})();
