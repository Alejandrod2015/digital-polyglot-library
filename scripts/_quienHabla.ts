/** Tiradas de réplicas SIN acotación: dónde el lector no sabe quién habla.
 *  Una réplica está "acotada" si su párrafo lleva narración pegada (diz X,
 *  avisa X). Se marcan las tiradas de 3 o más seguidas y, aparte, las que
 *  empiezan después de un párrafo con DOS frases citadas (ahí se rompe la
 *  alternancia). */
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const CITA = /“([^”]+)”/g;
const pal = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;
(async () => {
  const id = process.argv[2] ?? "cmsyrge55000732u9oiu8wue3";
  const j = await p.journey.findUnique({ where: { id }, select: { topics: true } });
  const rows = (await p.journeyStory.findMany({ where: { journeyId: id }, select: { slug: true, text: true, topic: true, slotIndex: true } }))
    .sort((a, b) => ((j?.topics ?? []).indexOf(a.topic) - (j?.topics ?? []).indexOf(b.topic)) || (a.slotIndex - b.slotIndex));
  let totalTiradas = 0, historiasCon = 0, rotas = 0;
  for (const s of rows) {
    const ps = (s.text ?? "").split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);
    const nombres = new Set((s.text ?? "").match(/\b[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]{2,}\b/g)?.filter((n) => !/^(No|Na|Nos|Nas|Do|Da|Dos|Das|Ao|Um|Uma|Os|As|Ela|Ele|Eles|Elas|Quem|Assim|Depois|Antes|Sem|Com|Mais|Agora|Hoje|Amanhã|Aqui|Ali|Lá|Tem|Cabe|Tudo|Isso|Essa|Esse|Meu|Dez|Quinze|Vinte|Dois|Duas|Três|Cada|Todo|Toda|Que|Por|Para|Mas|Senão|Vai|Bate|Faz|Levanta|Confere|Filma|Bebe|Cortou|Perdeu|Perdi|Viu|Vi|Acordo|Serve|Verdade|Precisa|Derrete|Vendo|Fica|Está|Não|Sim|Uns|Umas|Quanto|Quando|Onde|Nunca|Prática|Carnaval|Brasil)$/.test(n)) ?? []);
    let run = 0, inicio = -1, previaDoble = false;
    const tiradas: string[] = [];
    ps.forEach((x, i) => {
      const citas = [...x.matchAll(CITA)];
      if (!citas.length) { run = 0; previaDoble = false; return; }
      const fuera = pal(x.replace(CITA, " "));
      if (fuera >= 2) { run = 0; previaDoble = citas.length >= 2 || /”[^“]*“/.test(x); return; }
      if (run === 0) inicio = i;
      run++;
      if (run === 3 || (run === 2 && previaDoble)) tiradas.push(`${inicio + 1}-${i + 1}${previaDoble ? " (tras réplica doble)" : ""}`);
      if (run >= 3 && previaDoble) rotas++;
    });
    if (tiradas.length) { historiasCon++; totalTiradas += tiradas.length; console.log(`${s.slug.padEnd(28)} ${nombres.size} nombres · tiradas sin acotar: ${tiradas.join("; ")}`); }
  }
  console.log(`\n${historiasCon}/${rows.length} historias con tiradas de 3+ réplicas sin acotar · ${totalTiradas} tiradas`);
  await p.$disconnect();
})();
