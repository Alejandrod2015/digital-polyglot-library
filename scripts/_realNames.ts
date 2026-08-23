import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
async function main() {
  const n = (await p.betaSignup.findMany({ select: { email: true } }))
    .flatMap((b) => String(b.email ?? "").split("@")[0].split(/[._\-+0-9]+/))
    .filter((w) => w.length >= 3).map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
  const test = ["Julieta", "Damian", "Damián", "Micaela", "Agustina", "Facundo", "Nadia", "Rocio", "Malena", "Brenda", "Leandro", "Ezequiel", "Vera", "Ayelen", "Franco", "Gonzalo"];
  console.log("choques:", test.filter((t) => n.some((r) => r === t)).join(", ") || "ninguno");
  console.log("total nombres reales:", new Set(n).size);
  await p.$disconnect();
}
main().catch(async (e) => { console.error(e); await p.$disconnect(); process.exit(1); });
