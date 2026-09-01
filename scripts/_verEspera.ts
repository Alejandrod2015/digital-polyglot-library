import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const s = await p.journeyStory.findFirst({ where: { slug: "marta-ensena-el-retiro" }, select: { text: true, vocab: true } });
  const t = s!.text as string;
  for (const w of ["espera", "flor", "conten"]) {
    const re = new RegExp(`[^.]*\\b${w}\\p{L}*[^.]*\\.`, "giu");
    console.log(`${w}: ${(t.match(re) ?? []).slice(0, 2).join(" || ") || "no aparece"}`);
  }
  console.log("--- vocab:", (s!.vocab as Array<{ word: string }>).map((v) => v.word).join(", "));
  await p.$disconnect();
})();
