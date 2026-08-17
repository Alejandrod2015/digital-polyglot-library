import { config } from "dotenv"; config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async()=>{
  const objetivo = [
    { etiqueta: "PT-BR Traveler A0", where: { language: { equals: "portuguese", mode: "insensitive" as const } } },
    { etiqueta: "ES-Spain Friends A0", where: { language: { equals: "spanish", mode: "insensitive" as const }, variant: "spain" } },
  ];
  for (const o of objetivo) {
    const j = await p.journey.findFirst({ where: { ...o.where, status: { notIn: ["archived","draft"] } }, select: { id:true, name:true, levels:true } });
    if (!j) { console.log(`${o.etiqueta}: no encontrado`); continue; }
    const st = await p.journeyStory.findMany({ where: { journeyId: j.id, status: "published" }, select: { title:true, text:true, vocab:true }, orderBy: { slotIndex: "asc" } });
    const palabras = st.map(s => (s.text ?? "").split(/\s+/).filter(Boolean).length);
    const oraciones = st.map(s => (s.text ?? "").split(/(?<=[.!?])\s+/).filter(Boolean).length);
    const parrafos = st.map(s => (s.text ?? "").split(/\n\s*\n/).filter(Boolean).length);
    const conDialogo = st.filter(s => /["""«]/.test(s.text ?? "")).length;
    const media = (a:number[]) => Math.round(a.reduce((x,y)=>x+y,0)/a.length);
    const largoOracion = st.map(s => { const o=(s.text??"").split(/(?<=[.!?])\s+/).filter(Boolean); return o.length? Math.round((s.text??"").split(/\s+/).length/o.length):0; });
    console.log(`\n══ ${o.etiqueta} · ${j.name} · niveles ${j.levels.join(",")} · ${st.length} historias`);
    console.log(`   palabras/historia : ${media(palabras)}  (min ${Math.min(...palabras)}, max ${Math.max(...palabras)})`);
    console.log(`   oraciones/historia: ${media(oraciones)}`);
    console.log(`   palabras/oración  : ${media(largoOracion)}`);
    console.log(`   párrafos/historia : ${media(parrafos)}`);
    console.log(`   con diálogo entrecomillado: ${conDialogo}/${st.length}`);
    console.log(`   vocab/historia    : ${media(st.map(s => ((s.vocab as unknown[]) ?? []).length))}`);
  }
})().finally(()=>p.$disconnect());
