/** ¿Como puntuarian los A0 PUBLICADOS si obedecieran el tope de dos plazas por
 *  palabra? Mide con el criterio exacto del gate: encuentro = el token de
 *  `surface` aparece en ese cuerpo. Solo lectura. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const clave=(x:string)=>x.toLowerCase().replace(/^(der|die|das|el|la|los|las|il|lo|o|a|os|as|le|les)\s+/,"");
const tok=(t:string)=>(t.toLowerCase().match(/\p{L}+/gu)??[]);
(async()=>{
  const js = await p.journey.findMany({
    where: { status: { not: "archived" }, levels: { has: "a0" } },
    select: { id:true, language:true, variant:true, status:true, typeSlug:true,
      stories: { select: { text:true, vocab:true } } },
  });
  console.log("journey\testado\tplazas\tdistintas\tmax x palabra\tescalera\tcon tope 2");
  for (const j of js) {
    const ss = j.stories.filter(s=>s.text);
    if (ss.length < 10) continue;
    const cuerpos = ss.map(s=>new Set(tok(String(s.text))));
    const enc=(x:string)=>cuerpos.filter(c=>c.has(clave(x))).length;
    const usos=new Map<string,number>();
    const todas:Array<{k:string;e:number}>=[];
    for (const s of ss) for (const v of ((s.vocab as any[])??[])) {
      const k=clave(String(v.word)); usos.set(k,(usos.get(k)??0)+1);
      todas.push({k, e:enc(String(v.surface ?? v.word))});
    }
    const media = todas.reduce((a,b)=>a+b.e,0)/todas.length;
    // con tope 2: sobreviven las dos primeras plazas de cada palabra
    const vistos=new Map<string,number>(); const cap:number[]=[];
    for (const t of todas){ const n=(vistos.get(t.k)??0); if(n<2){ vistos.set(t.k,n+1); cap.push(t.e); } }
    const maxPorPalabra = Math.max(...usos.values());
    console.log([`${j.language}/${j.variant}`, j.status, todas.length, usos.size, maxPorPalabra,
      media.toFixed(2), (cap.reduce((a,b)=>a+b,0)/cap.length).toFixed(2)].join("\t"));
  }
  await p.$disconnect();
})();
