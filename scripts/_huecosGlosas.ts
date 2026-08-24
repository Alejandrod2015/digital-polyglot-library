/** Vuelca cada forma SIN glosa del bundle indicado junto a la primera frase
 *  donde aparece, para escribirla en contexto (feedback_gloss_in_context). */
import fs from "node:fs";
import { PrismaClient } from "../src/generated/prisma";
import { extractStoryPlainText } from "../src/lib/storyPlainText";
const p = new PrismaClient();
const TAPPABLE = /[\p{L}\p{N}][\p{L}\p{N}'\-]*/gu;
const NOMBRES = /^(rafaela|matheus|bruna|larissa|selma|dora|neide|iara|vera|solange|dorival|tain[áa])$/i;
const clave = (t: string) => (t.toLowerCase().match(/\p{L}+(?:-\p{L}+)*/u) ?? [""])[0];
(async () => {
  const name = process.argv[2];
  const b = JSON.parse(fs.readFileSync(`src/data/tapGlosses/${name}.json`, "utf8")) as { slugs: string[]; glosses: Record<string, unknown> };
  const hermano = JSON.parse(fs.readFileSync("src/data/tapGlosses/portuguese-traveler-brazil-a0.json", "utf8")) as { glosses: Record<string, { g: string }> };
  const rows = await p.journeyStory.findMany({ where: { slug: { in: b.slugs } }, select: { slug: true, title: true, text: true } });
  const frase = new Map<string, string>();
  const orden: string[] = [];
  for (const s of rows) {
    const txt = `${s.title}. ${extractStoryPlainText(s.text ?? "")}`;
    for (const f of txt.replace(/\s+/g, " ").split(/(?<=[.!?…”])\s+/).map((x) => x.trim()).filter(Boolean)) {
      for (const tok of f.match(TAPPABLE) ?? []) {
        const k = clave(tok);
        if (!k || b.glosses[k] || frase.has(k) || NOMBRES.test(k)) continue;
        frase.set(k, f); orden.push(k);
      }
    }
  }
  const soloNuevas = process.argv.includes("--nuevas");
  const desde = Number(process.argv.find((a) => a.startsWith("--desde="))?.split("=")[1] ?? 0);
  const cuantas = Number(process.argv.find((a) => a.startsWith("--n="))?.split("=")[1] ?? 9999);
  const lista = orden.filter((k) => (soloNuevas ? !hermano.glosses[k] : true)).slice(desde, desde + cuantas);
  for (const k of lista) console.log(`${k}\t${frase.get(k)!.slice(0, 120)}`);
  console.log(`\n[${lista.length} de ${orden.filter((k) => (soloNuevas ? !hermano.glosses[k] : true)).length}]`);
  await p.$disconnect();
})();
