/** Compara la FORMA de narrar de dos journeys: cuánto es habla citada, cuántos
 *  turnos, cómo son los párrafos y cómo se atribuye quién habla. */
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const pal = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;
(async () => {
  const pares: Array<[string, string]> = process.argv.length > 2
  ? [["arg", process.argv[2]]]
  : [["A0 (vivo)", "cmsou2uk0000732mqa4oatcmn"], ["A1 (draft)", "cmsyrge55000732u9oiu8wue3"]];
  for (const [nombre, id] of pares) {
    const j = await p.journey.findUnique({ where: { id }, select: { topics: true } });
    const rows = (await p.journeyStory.findMany({ where: { journeyId: id }, select: { slug: true, title: true, text: true, topic: true, slotIndex: true } }))
      .sort((a, b) => ((j?.topics ?? []).indexOf(a.topic) - (j?.topics ?? []).indexOf(b.topic)) || (a.slotIndex - b.slotIndex));
    let W = 0, Q = 0, turnos = 0, parr = 0, atrib = 0, parrCitados = 0, mixtos = 0;
    const largos: number[] = [];
    for (const s of rows) {
      const t = s.text ?? "";
      W += pal(t);
      for (const m of t.matchAll(/\u201C([^\u201D]+)\u201D/g)) Q += pal(m[1]);
      const ps = t.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);
      parr += ps.length;
      for (const x of ps) {
        largos.push(pal(x));
        const citas = [...x.matchAll(/\u201C([^\u201D]+)\u201D/g)];
        if (citas.length) {
          turnos += citas.length;
          parrCitados++;
          const fuera = pal(x.replace(/\u201C[^\u201D]*\u201D/g, " "));
          if (fuera >= 2) { mixtos++; atrib++; }
        }
      }
    }
    const media = largos.reduce((a, b) => a + b, 0) / largos.length;
    console.log(`\n== ${nombre}: ${rows.length} historias`);
    console.log(`palabras/historia      ${(W / rows.length).toFixed(0)}`);
    console.log(`habla citada           ${((Q / W) * 100).toFixed(0)}%`);
    console.log(`turnos citados/historia ${(turnos / rows.length).toFixed(1)}`);
    console.log(`párrafos/historia      ${(parr / rows.length).toFixed(1)}  ·  palabras/párrafo ${media.toFixed(1)}`);
    console.log(`párrafos con cita      ${((parrCitados / parr) * 100).toFixed(0)}%  ·  de ellos con narración pegada (atribución) ${((mixtos / parrCitados) * 100).toFixed(0)}%`);
    
  }
  await p.$disconnect();
})();
