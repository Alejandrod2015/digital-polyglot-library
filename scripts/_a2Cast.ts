import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import { createRequire } from "module";
const __req = createRequire(__filename);
try { const q = __req.resolve("server-only"); (__req as any).cache[q] = { id:q, filename:q, loaded:true, exports:{} }; } catch {}
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const HABLA = "dice|dijo|pregunta|preguntó|responde|respondió|contesta|contestó|insiste|insistió|repite|repitió|cuenta|contó|explica|explicó|admite|admitió|añade|añadió";
(async () => {
  const ss = await p.journeyStory.findMany({ where: { journeyId: "cmtgelq560007j84n3ujx9bpd", NOT: { text: null } }, select: { slug: true, text: true } });
  const conta = new Map<string, Set<string>>();
  for (const s of ss) for (const re of [
      new RegExp(`(?:${HABLA})\\s+([\\p{Lu}][\\p{Ll}]+)`, "gu"),
      new RegExp(`([\\p{Lu}][\\p{Ll}]+)\\s+(?:${HABLA})`, "gu")])
    for (const m of s.text!.matchAll(re)) {
      if (!conta.has(m[1])) conta.set(m[1], new Set());
      conta.get(m[1])!.add(s.slug!);
    }
  console.log("nombres junto a verbo de habla:");
  for (const [k, v] of [...conta].sort((a,b)=>b[1].size-a[1].size)) console.log(`  ${k.padEnd(12)} en ${v.size} historias`);
  // castLegacy: exige ir precedido de minuscula o coma, y NO de articulo
  const ART=/\b(el|la|los|las|un|una|unos|unas)\s+$/i, MID=/[\p{Ll}],?\s+$/u;
  const cuenta=new Map<string,number>();
  for (const s of ss) { const vistos=new Set<string>();
    for (const m of s.text!.matchAll(/\p{Lu}\p{Ll}{2,}/gu)) {
      const i=m.index??0, antes=s.text!.slice(Math.max(0,i-14),i);
      if (ART.test(antes)) continue;
      if (MID.test(antes)) vistos.add(m[0]);
    }
    for (const w of vistos) cuenta.set(w,(cuenta.get(w)??0)+1); }
  console.log("\ncastLegacy (>=2 historias):", [...cuenta].filter(([,n])=>n>=2).map(([w,n])=>`${w}(${n})`).join(", ")||"VACIO");
})().finally(() => p.$disconnect());
