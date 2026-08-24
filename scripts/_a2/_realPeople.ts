import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const names = (await p.betaSignup.findMany({ select: { email: true } }))
    .flatMap((b) => String(b.email ?? "").split("@")[0].split(/[._\-+0-9]+/))
    .filter((w) => w.length >= 3)
    .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
  console.log([...new Set(names)].sort().join(" "));
})().finally(() => p.$disconnect());
