import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
async function main() {
  const id = process.argv[2];
  const j = await p.journey.findUnique({ where: { id }, select: { topics: true, name: true, variant: true } });
  const filas = (await p.journeyStory.findMany({ where: { journeyId: id }, select: { slug: true, text: true, vocab: true, topic: true, slotIndex: true } }));
  const tok = (t: string) => (t.toLowerCase().match(/\p{L}+/gu) ?? []);
  const cuerpos = filas.map((f) => new Set(tok(String(f.text ?? ""))));
  const clave = (v: any) => String(v.surface ?? v.word).toLowerCase().replace(/^(der|die|das|le|la|el|il|o|a)\s+/, "");
  const enc: number[] = []; const todas: string[] = [];
  for (const f of filas) for (const v of ((f.vocab as any[]) ?? [])) {
    enc.push(cuerpos.filter((c) => c.has(clave(v))).length); todas.push(clave(v));
  }
  const media = enc.reduce((a,b)=>a+b,0)/enc.length;
  console.log(`${j?.name}/${j?.variant} · ${filas.length} historias · ${enc.length} plazas · media ${media.toFixed(2)}`);
  console.log(`  plazas con 0 encuentros: ${enc.filter(n=>n===0).length} · 1: ${enc.filter(n=>n===1).length} · >=4: ${enc.filter(n=>n>=4).length}`);
  const set = new Set(todas);
  const porCuerpo = cuerpos.map((c) => [...set].filter((w) => c.has(w)).length);
  const pal = filas.map((f) => String(f.text ?? "").split(/\s+/).length);
  console.log(`  palabras ensenadas presentes por cuerpo: ${porCuerpo.join(", ")}`);
  console.log(`  largo de cuerpo: ${pal.join(", ")}`);
  const top = [...set].map((w) => ({w, n: cuerpos.filter(c=>c.has(w)).length})).sort((a,b)=>b.n-a.n).slice(0,25);
  console.log("  top: " + top.map(t=>`${t.w}(${t.n})`).join(" "));
  const dis = new Map<string, number>();
  for (const w of todas) dis.set(w, (dis.get(w) ?? 0) + 1);
  const repes = [...dis].filter(([,n])=>n>1);
  console.log(`  distintas ensenadas: ${dis.size} de ${todas.length} plazas · repetidas: ${repes.length} (${repes.slice(0,10).map(([w,n])=>w+'x'+n).join(' ')})`);
  const mediaDist = [...dis.keys()].map(w=>cuerpos.filter(c=>c.has(w)).length).reduce((a,b)=>a+b,0)/dis.size;
  console.log(`  media de encuentros por palabra DISTINTA: ${mediaDist.toFixed(2)}`);
  await p.$disconnect();
}
main().catch(async (e) => { console.error(e); await p.$disconnect(); process.exit(1); });
