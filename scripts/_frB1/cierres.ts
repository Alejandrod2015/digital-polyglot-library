/** Trabajo: cierres a solas (formula de journey-closing-alone) con un reparto dado. Uso: cierres.ts tanda.json Nombre1,Nombre2 */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import * as fs from "fs";
import { PrismaClient } from "../../src/generated/prisma";
async function main() {
  const p = new PrismaClient();
  let st = (await p.journeyStory.findMany({ where: { journeyId: "cmu0doigc0007j8e292tycths", text: { not: null } }, select: { topic: true, slotIndex: true, slug: true, text: true } })) as any[];
  await p.$disconnect();
  const f = process.argv[2]; if (f?.endsWith(".json")) { const d = JSON.parse(fs.readFileSync(f, "utf8")); const k = new Set(d.map((x: any) => `${x.topic}#${x.slotIndex}`)); st = st.filter((s) => !k.has(`${s.topic}#${s.slotIndex}`)).concat(d); }
  const otros = (process.argv[3] ?? "").split(",").filter(Boolean);
  const hablaFR = "dit|demande|répond|ajoute|explique|répète|crie|écrit|raconte|promet|rit|appelle|propose|corrige|note";
  const cuenta = new Map<string, Set<string>>();
  for (const s of st) for (const re of [new RegExp(`(?:${hablaFR})\\s+([\\p{Lu}][\\p{Ll}]+)`, "gu"), new RegExp(`([\\p{Lu}][\\p{Ll}]+)\\s+(?:${hablaFR})`, "gu")]) for (const m of s.text.matchAll(re)) { if (!cuenta.has(m[1])) cuenta.set(m[1], new Set()); cuenta.get(m[1])!.add(s.slug ?? s.topic + s.slotIndex); }
  console.log("hablan (historias):", [...cuenta].map(([k, v]) => `${k}:${v.size}`).join(" "));
  const solos = st.filter((s) => { const u = s.text.trim().split(/\n{2,}/).pop() ?? ""; if (u.includes("“")) return false; return !otros.some((n) => u.includes(n)); });
  console.log(`a solas con reparto [${otros}]: ${solos.length}/${st.length} (tope ${Math.ceil(st.length / 2)}):`, solos.map((s) => s.slug ?? s.topic + "#" + s.slotIndex).join(", "));
}
main();
