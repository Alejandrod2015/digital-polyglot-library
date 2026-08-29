/** Como resuelve HOY cada token con apostrofo de un bundle. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import fs from "node:fs";
import { PrismaClient } from "../src/generated/prisma";
import { TAPPABLE, resolveGloss, glossKeyCandidates } from "../src/lib/tapGlossKey";
const p = new PrismaClient();
(async () => {
  const [bundle, fichero] = process.argv.slice(2);
  const g = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle, slug: "" } } });
  const mapa = g!.glosses as Record<string, { g: string }>;
  const textos = JSON.parse(fs.readFileSync(fichero, "utf8")) as Record<string, string>;
  const vistos = new Map<string, number>();
  for (const t of Object.values(textos)) {
    for (const tok of t.replace(/<[^>]+>/g, " ").match(TAPPABLE) ?? []) {
      if (!/['’]/.test(tok)) continue;
      const k = tok.toLowerCase();
      vistos.set(k, (vistos.get(k) ?? 0) + 1);
    }
  }
  for (const [tok, n] of [...vistos].sort((a, b) => b[1] - a[1])) {
    const h = resolveGloss(mapa, tok);
    console.log(`${String(n).padStart(3)} ${tok.padEnd(14)} -> ${(h?.token ?? "NADA").padEnd(10)} ${h ? (h.gloss as {g:string}).g : ""}   [${glossKeyCandidates(tok).join(", ")}]`);
  }
  await p.$disconnect();
})();
