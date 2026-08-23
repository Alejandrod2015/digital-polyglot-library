import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import fs from "fs";
import path from "path";
import { PrismaClient } from "../src/generated/prisma";
import { TAPPABLE, resolveGloss } from "../src/lib/tapGlossKey";

// La clave VIEJA, tal cual estaba, para poder comparar antes/después.
const vieja = (t: string) => (t.toLowerCase().match(/\p{L}+(?:-\p{L}+)*/u) ?? [""])[0];
const p = new PrismaClient();
const DIR = "src/data/tapGlosses";

(async () => {
  const bundles = fs.readdirSync(DIR).filter((f) => f.endsWith(".json"))
    .map((f) => ({ name: f.replace(/\.json$/, ""), ...JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8")) }));
  // live + draft. Los archived quedan fuera a propósito: son estructura muerta.
  const stories = await p.journeyStory.findMany({
    where: { slug: { not: null }, text: { not: null }, journey: { status: { in: ["active", "draft"] } } },
    select: { slug: true, text: true, journey: { select: { language: true, variant: true, name: true, levels: true, status: true } } },
  });
  type Row = { antes: number; ahora: number; total: number; bundle: boolean };
  const acc = new Map<string, Row>();
  for (const s of stories) {
    const b = bundles.find((x) => (x.slugs as string[]).includes(s.slug!));
    const j = s.journey;
    const k = `${j.name} ${j.language}/${j.variant} ${JSON.stringify(j.levels)} ${j.status === "active" ? "live " : "draft"}`;
    const r = acc.get(k) ?? { antes: 0, ahora: 0, total: 0, bundle: false };
    if (b) r.bundle = true;
    for (const t of (s.text ?? "").match(TAPPABLE) ?? []) {
      if (!/['’]/.test(t)) continue;
      r.total++;
      if (!b) continue;
      const v = vieja(t);
      const antes = b.glosses[v];
      const ahora = resolveGloss(b.glosses as Record<string, { g: string }>, t);
      if (ahora) r.ahora++;
      if (antes && ahora && ahora.token === v) r.antes++;
    }
    acc.set(k, r);
  }
  console.log("journey".padEnd(44), "elididas  bien ANTES  bien AHORA  paquete");
  for (const [k, r] of [...acc].sort((a, b2) => b2[1].total - a[1].total)) {
    if (!r.total) continue;
    console.log(k.padEnd(44), String(r.total).padStart(6), String(r.antes).padStart(11),
      String(r.ahora).padStart(11), "   ", r.bundle ? "sí" : "TODAVÍA NO");
  }
  await p.$disconnect();
})();
