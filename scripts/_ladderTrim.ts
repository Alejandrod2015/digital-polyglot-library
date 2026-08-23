/**
 * ¿Cuánto se puede RECORTAR sin caer del suelo de recirculación?
 *
 * Los cuerpos engordaron al tejer vocabulario, y cada palabra de más es audio
 * de más. Este script prueba a quitar, frase a frase, las que menos aportan:
 * mide cuántas plazas del journey aporta cada frase EN EXCLUSIVA (si se quita,
 * esas plazas pierden un encuentro) y va cortando las de aporte cero mientras
 * la media siga por encima del suelo.
 *
 * Solo lectura: imprime qué frase se quitaría de cada historia.
 *
 *   npx tsx scripts/_ladderTrim.ts <journeyId> [suelo]
 */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();

const tok = (t: string) => (t.toLowerCase().match(/\p{L}+/gu) ?? []);
const clave = (v: { word: string; surface?: string | null }) =>
  String(v.surface ?? v.word).toLowerCase().replace(/^(le|la|les|un|une|des|du|de)\s+/, "");
const frases = (t: string) => t.split(/(?<=[.!?”])\s+/).filter((x) => x.trim());

async function main() {
  const id = process.argv[2];
  const suelo = Number(process.argv[3] ?? 3.0);
  const st = await p.journeyStory.findMany({
    where: { journeyId: id, text: { not: null } },
    select: { slug: true, text: true, vocab: true },
  });
  const vocabs = st.map((s) => ((s.vocab as Array<{ word: string; surface?: string; anchor?: boolean }>) ?? []));
  const textos = st.map((s) => s.text!);

  const media = () => {
    const cuerpos = textos.map((t) => new Set(tok(t)));
    let n = 0, suma = 0;
    vocabs.forEach((vs) => vs.forEach((v) => {
      if (v.anchor) return;
      n++; suma += cuerpos.filter((c) => c.has(clave(v))).length;
    }));
    return suma / n;
  };

  console.log(`media de partida ${media().toFixed(2)} · palabras ${textos.reduce((a, t) => a + t.split(/\s+/).length, 0)}`);
  let quitadas = 0, palabras = 0;
  for (let i = 0; i < textos.length; i++) {
    for (const f of frases(textos[i])) {
      if (f.includes("“")) continue;                 // el diálogo no se toca
      const antes = textos[i];
      textos[i] = antes.replace(f, "").replace(/\n{3,}/g, "\n\n").replace(/ {2,}/g, " ").trim();
      const nuevaMedia = media();
      const corto = textos[i].split(/\s+/).length;
      if (nuevaMedia >= suelo && corto >= 130) {
        quitadas++; palabras += f.split(/\s+/).length;
        console.log(`  ${st[i].slug}: “${f.trim().slice(0, 70)}”`);
      } else {
        textos[i] = antes;                           // se devuelve: hacía falta
      }
    }
  }
  console.log(`\nse pueden quitar ${quitadas} frases · ${palabras} palabras · media final ${media().toFixed(2)}`);
  console.log(`palabras totales: ${textos.reduce((a, t) => a + t.split(/\s+/).length, 0)}`);
  await p.$disconnect();
}
main();
