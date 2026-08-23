/** Margen real para subir la escalera: por historia, palabras de SU cuerpo que
 *  reaparecen en otros cuerpos y todavia no son plaza de vocab en ningun sitio. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const j = await p.journey.findUnique({ where: { id: "cmt0a8vb1000m32p1x7r5ba28" }, select: { topics: true } });
  const orden = j?.topics ?? [];
  const st = (await p.journeyStory.findMany({
    where: { journeyId: "cmt0a8vb1000m32p1x7r5ba28" },
    select: { slug: true, topic: true, slotIndex: true, text: true, vocab: true },
  })).sort((a, b) => (orden.indexOf(a.topic) - orden.indexOf(b.topic)) || (a.slotIndex - b.slotIndex));

  const tok = (t: string) => (t.toLowerCase().match(/\p{L}+/gu) ?? []);
  const cuerpos = st.map((s) => new Set(tok(String(s.text))));
  const clave = (v: any) => String(v.surface ?? v.word).toLowerCase().replace(/^(der|die|das)\s+/, "");
  const yaVocab = new Set(st.flatMap((s) => ((s.vocab as any[]) ?? []).map(clave)));
  // Palabras vacias: no son candidatas a plaza de vocab.
  const STOP = new Set("und der die das den dem des ein eine einen einem einer ist sind war ich du er sie es wir ihr nicht kein keine mit von zu in im am an auf aus bei nach vor über unter für als wie so aber oder dann noch nur schon auch sehr mehr sich ihm ihn ihre ihren ihrer seine seinen sein hat habe haben wird werden kann können muss müssen will wollen mich mir dich dir uns euch man jetzt hier da dort weil dass wenn ob zum zur vom beim ins".split(" "));

  let total = 0, cubiertos = 0;
  const filas: string[] = [];
  st.forEach((s, i) => {
    const voc = ((s.vocab as any[]) ?? []);
    const flojas = voc.filter((v) => cuerpos.filter((c) => c.has(clave(v))).length <= 1);
    const cand = [...cuerpos[i]]
      .filter((w) => w.length >= 4 && !STOP.has(w) && !yaVocab.has(w))
      .map((w) => ({ w, n: cuerpos.filter((c) => c.has(w)).length }))
      .filter((x) => x.n >= 3)
      .sort((a, b) => b.n - a.n);
    total += flojas.length; cubiertos += Math.min(flojas.length, cand.length);
    filas.push(`${String(i + 1).padStart(2)} ${s.slug.slice(0, 30).padEnd(30)} flojas ${String(flojas.length).padStart(2)} · candidatas ${String(cand.length).padStart(2)}  ${cand.slice(0, 6).map((c) => `${c.w}(${c.n})`).join(" ")}`);
  });
  filas.forEach((f) => console.log(f));
  console.log(`\nplazas que salen una sola vez: ${total} · cubribles con palabras del propio cuerpo que ya reaparecen: ${cubiertos}`);
  await p.$disconnect();
})();
