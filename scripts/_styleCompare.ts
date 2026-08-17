// Compara la FORMA de las historias entre journeys: longitud, párrafos,
// oraciones por párrafo, longitud de oración, diálogo y apertura. Solo lee.
import { config } from "dotenv"; config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();

function stats(text: string) {
  const paras = text.split(/\n\s*\n/).map(x=>x.trim()).filter(Boolean);
  const oraciones = text.split(/(?<=[.!?])\s+/).map(x=>x.trim()).filter(Boolean);
  const palabras = text.split(/\s+/).filter(Boolean);
  const conDialogo = /["«»""]/.test(text);
  const oracionesPorPara = paras.map(x => x.split(/(?<=[.!?])\s+/).filter(Boolean).length);
  return {
    palabras: palabras.length,
    paras: paras.length,
    oraciones: oraciones.length,
    palPorOracion: +(palabras.length / Math.max(1,oraciones.length)).toFixed(1),
    formaParas: oracionesPorPara.join("-"),
    dialogo: conDialogo,
    primera: oraciones[0] ?? "",
  };
}

async function main() {
  const js = await p.journey.findMany({
    where: { status: { notIn:["archived","draft"] }, levels: { has: "a0" } },
    select: { id:true, name:true, language:true, variant:true },
  });
  for (const j of js) {
    const st = await p.journeyStory.findMany({ where:{ journeyId:j.id, status:"published" }, select:{ slug:true, text:true }, orderBy:{ createdAt:"asc" } });
    const all = st.map(s => stats(s.text ?? ""));
    const formas = new Map<string,number>();
    for (const a of all) formas.set(a.formaParas, (formas.get(a.formaParas) ?? 0) + 1);
    const media = (f:(a:ReturnType<typeof stats>)=>number) => +(all.reduce((n,a)=>n+f(a),0)/all.length).toFixed(1);
    console.log(`\n══ ${j.language}/${j.variant} · ${j.name}  (${st.length} historias)`);
    console.log(`   palabras/historia : ${media(a=>a.palabras)}`);
    console.log(`   párrafos          : ${media(a=>a.paras)}`);
    console.log(`   oraciones          : ${media(a=>a.oraciones)}`);
    console.log(`   palabras/oración   : ${media(a=>a.palPorOracion)}`);
    console.log(`   con diálogo        : ${all.filter(a=>a.dialogo).length}/${all.length}`);
    const orden = [...formas.entries()].sort((a,b)=>b[1]-a[1]);
    console.log(`   formas distintas   : ${formas.size} (la más repetida "${orden[0][0]}" en ${orden[0][1]} historias)`);
    console.log(`   primeras frases:`);
    for (const a of all.slice(0,4)) console.log(`      · ${a.primera.slice(0,88)}`);
  }
}
main().finally(()=>p.$disconnect());
