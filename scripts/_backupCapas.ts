import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import fs from "node:fs";
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
(async () => {
  const rows = await prisma.tapGlossSet.findMany({ select: { bundle: true, slug: true, glosses: true } });
  fs.writeFileSync(process.argv[2], JSON.stringify(rows));
  console.log("filas:", rows.length, "->", process.argv[2]);
  await prisma.$disconnect();
})();
