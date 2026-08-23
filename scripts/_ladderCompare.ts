/** La cifra de la ESCALERA (reencuentro en OTRA historia) sobre journeys ya
 *  publicados, para comparar con la del journey nuevo. Solo lectura. */
import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
async function main() {
  const js = await p.journey.findMany({
    where: { language: "spanish", status: { in: ["active", "draft"] }, levels: { has: "a0" } },
    select: { id: true, name: true, variant: true },
  });
  for (const j of js) {
    const filas = await p.journeyStory.findMany({ where: { journeyId: j.id }, select: { text: true, vocab: true } });
    const cuerpos = filas.map((f) => new Set((String(f.text ?? "").toLowerCase().match(/\p{L}+/gu) ?? [])));
    const clave = (v: any) => String(v.surface ?? v.word).toLowerCase().replace(/^(el|la|los|las)\s+/, "");
    let n = 0, sin = 0, ge4 = 0, suma = 0;
    // Por PALABRA DISTINTA, no por plaza: contar siete veces la misma palabra
    // recurrente maquilla las tres cifras a la vez.
    const dis = new Map<string, number>();
    filas.forEach((f, i) => {
      for (const v of ((f.vocab as any[]) ?? [])) {
        const otras = cuerpos.filter((c, k) => k !== i && c.has(clave(v))).length;
        n++; suma += otras; if (otras === 0) sin++; if (otras >= 3) ge4++;
        if (!dis.has(clave(v))) dis.set(clave(v), otras);
      }
    });
    if (!n) continue;
    const dn = dis.size;
    const dsin = [...dis.values()].filter((x) => x === 0).length;
    const dge4 = [...dis.values()].filter((x) => x >= 3).length;
    const dsum = [...dis.values()].reduce((a, b) => a + b, 0);
    console.log(`${(j.name + "/" + j.variant).padEnd(20)} plazas ${String(n).padStart(3)} (${dn} distintas)`);
    console.log(`   por plaza:    media ${(suma / n).toFixed(2)} · sin reencuentro ${Math.round(100 * sin / n)}% · a 4 historias ${Math.round(100 * ge4 / n)}%`);
    console.log(`   por palabra:  media ${(dsum / dn).toFixed(2)} · sin reencuentro ${Math.round(100 * dsin / dn)}% · a 4 historias ${Math.round(100 * dge4 / dn)}%`);
  }
  await p.$disconnect();
}
main().catch(async (e) => { console.error(e); await p.$disconnect(); process.exit(1); });
