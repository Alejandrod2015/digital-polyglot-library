/** Palabras que solo viven en la fila GLOBAL pero se pueden TOCAR en alguna
 *  historia: hay que leerlas igual, con la frase donde caen. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import * as fs from "fs";
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient(); const B = "spanish-traveler-latam-a2";
(async () => {
  const rows = await p.tapGlossSet.findMany({ where: { bundle: B }, select: { slug: true, glosses: true } });
  const glob: any = rows.find((r) => !r.slug)!.glosses;
  const porHist = new Set<string>();
  for (const r of rows) if (r.slug) for (const k of Object.keys((r.glosses as any) ?? {})) porHist.add(k.toLowerCase());
  const ss = await p.journeyStory.findMany({
    where: { journeyId: "cmtgelq560007j84n3ujx9bpd" }, select: { title: true, text: true },
  });
  const frases = ss.flatMap((s) => `${s.title}. ${s.text}`.split(/(?<=[.?!”])\s+/).map((f) => f.trim())).filter(Boolean);
  const out: any[] = [];
  for (const k of Object.keys(glob)) {
    if (porHist.has(k.toLowerCase())) continue;
    const rx = new RegExp(`(^|[^\\p{L}])${k.toLowerCase()}([^\\p{L}]|$)`, "iu");
    const f = frases.find((x) => rx.test(x));
    if (!f) continue;
    out.push({ k, t: glob[k].t ?? "", g: glob[k].g ?? "", frase: f.slice(0, 70) });
  }
  fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
  console.log(`tocables solo-global: ${out.length}`);
  for (const x of out) console.log(`${x.k}|${String(x.t).slice(0,4)}|${x.g.slice(0,40)}|${x.frase}`);
})().finally(() => p.$disconnect());
