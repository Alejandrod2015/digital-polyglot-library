// Ficha completa de quien pidió portugués: qué dijo y por qué se le respondió
// lo que se le respondió. Sólo lee.
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";

const p = new PrismaClient();
const PT = /portug|português|portugues|brasil|brazil/i;

async function main() {
  const filas = await p.betaSignup.findMany({ orderBy: { createdAt: "asc" } });
  const pt = filas.filter((a) => PT.test(a.targetLanguage ?? ""));
  for (const a of pt) {
    console.log("═".repeat(72));
    for (const [k, v] of Object.entries(a)) {
      if (v === null || v === undefined || v === "") continue;
      const s = v instanceof Date ? v.toISOString().slice(0, 16) : typeof v === "object" ? JSON.stringify(v) : String(v);
      console.log(`  ${k.padEnd(22)} ${s.slice(0, 300)}`);
    }
  }
}
main().finally(() => p.$disconnect());
