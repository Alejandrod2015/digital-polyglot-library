import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const words = (await p.betaSignup.findMany({ select: { email: true } }))
    .flatMap((b) => String(b.email ?? "").split("@")[0].split(/[._\-+0-9]+/))
    .filter((w) => w.length >= 3)
    .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
  const set = [...new Set(words)].sort();
  console.log(`${set.length} palabras de identidad`);
  for (const n of ["Irene","Rocio","Rocío","Quique","Rosa","Marta","Nico","Julian","Julián","Nerja","Elena","Paco","Loli","Curro","Mari","Toni","Sole","Charo","Puri","Reme"])
    if (set.some((w) => w.toLowerCase() === n.toLowerCase())) console.log(`  CHOCA: ${n}`);
  console.log("\nlista:", set.join(" "));
})().finally(() => p.$disconnect());
