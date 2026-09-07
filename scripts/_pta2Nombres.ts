/** SOLO LECTURA. Los nombres de personas REALES que saveStory/cierraTema
 *  derivan de BetaSignup.email, y los que ya usan las historias PT: para no
 *  bautizar a nadie con el nombre de un solicitante ni repetir reparto. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { extractProperNouns } from "../src/lib/validateGeneratedStory";
const p = new PrismaClient();
(async () => {
  const reales = new Set(
    (await p.betaSignup.findMany({ select: { email: true } }))
      .flatMap((b) => String(b.email ?? "").split("@")[0].split(/[._\-+0-9]+/))
      .filter((w) => w.length >= 3)
      .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()),
  );
  const ss = await p.journeyStory.findMany({
    where: { journey: { language: "portuguese" } },
    select: { text: true },
  });
  const enPT = new Set<string>();
  for (const s of ss) for (const n of extractProperNouns(String(s.text ?? ""))) enPT.add(n);
  const candidatos = process.argv.slice(2);
  console.log(`solicitantes derivados: ${reales.size} · nombres ya en historias PT: ${enPT.size}`);
  for (const c of candidatos)
    console.log(`  ${c.padEnd(12)} ${reales.has(c) ? "CHOCA con solicitante" : enPT.has(c) ? "ya sale en PT" : "libre"}`);
})().finally(() => p.$disconnect());
