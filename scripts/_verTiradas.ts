import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const CITA = /“([^”]+)”/g;
const pal = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;
(async () => {
  const id = "cmsyrge55000732u9oiu8wue3";
  const j = await p.journey.findUnique({ where: { id }, select: { topics: true } });
  const rows = (await p.journeyStory.findMany({ where: { journeyId: id }, select: { slug: true, text: true, topic: true, slotIndex: true } }))
    .sort((a, b) => ((j?.topics ?? []).indexOf(a.topic) - (j?.topics ?? []).indexOf(b.topic)) || (a.slotIndex - b.slotIndex));
  const solo = process.argv.slice(2);
  for (const s of rows) {
    if (solo.length && !solo.includes(s.slug!)) continue;
    const ps = (s.text ?? "").split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);
    const marcas: number[] = [];
    let run = 0, inicio = -1;
    ps.forEach((x, i) => {
      const citas = [...x.matchAll(CITA)];
      if (!citas.length || pal(x.replace(CITA, " ")) >= 2) { run = 0; return; }
      if (run === 0) inicio = i;
      run++;
      if (run >= 3) marcas.push(inicio);
    });
    if (!marcas.length) continue;
    console.log(`\n##### ${s.slug} (${pal(s.text ?? "")} pal)`);
    const ver = new Set<number>();
    for (const m of marcas) for (let k = Math.max(0, m - 1); k <= Math.min(ps.length - 1, m + 4); k++) ver.add(k);
    [...ver].sort((a, b) => a - b).forEach((i) => console.log(`  ${String(i + 1).padStart(2)}| ${ps[i]}`));
  }
  await p.$disconnect();
})();
