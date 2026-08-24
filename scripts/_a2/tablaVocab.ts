/**
 * Repeticion de vocabulario del journey, con la MISMA formula del gate
 * (`journey-vocab-recirculation`): por cada plaza, en cuantos CUERPOS distintos
 * del journey aparece su `surface` exacta. Repetirla tres veces dentro de su
 * propia historia sigue valiendo 1.
 */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
type V = { word: string; surface?: string | null; anchor?: boolean };
// El MISMO `clave` del gate, letra por letra, para que el numero de esta tabla
// sea el que imprime `journey-vocab-recirculation` y no otro parecido.
const clave = (v: V) => String(v.surface ?? v.word).toLowerCase().replace(/^(der|die|das|le|la|el|il|o|a)\s+/, "");
const tok = (t: string) => new Set((t.toLowerCase().match(/\p{L}+/gu) ?? []));

async function mide(id: string) {
  const j = await p.journey.findUnique({ where: { id }, select: { topics: true, name: true, variant: true, levels: true } });
  const st = await p.journeyStory.findMany({
    where: { journeyId: id, text: { not: null } },
    select: { topic: true, slotIndex: true, text: true, vocab: true },
  });
  const cuerpos = st.map((s) => tok(s.text!));
  const filas = st.flatMap((s) => ((s.vocab as V[]) ?? []).map((v) => ({
    topic: s.topic, n: cuerpos.filter((c) => c.has(clave(v))).length,
    anchor: Boolean(v.anchor), multi: clave(v).includes(" "),
  })));
  return { j: j!, topics: j!.topics, filas };
}
const media = (xs: Array<{ n: number }>) => xs.length ? xs.reduce((a, b) => a + b.n, 0) / xs.length : 0;

(async () => {
  const A2 = "cmt70xfyt000l3283gxd70wck";
  const { j, topics, filas } = await mide(A2);
  const labels = Object.fromEntries((await p.topic.findMany({ where: { slug: { in: topics } }, select: { slug: true, label: true } })).map((t) => [t.slug, t.label]));

  console.log(`| # | Tema | Plazas | Portables | Ancladas | Historias por plaza | Vuelven | Solo una vez |`);
  console.log(`|---|---|---|---|---|---|---|---|`);
  for (const [i, slug] of topics.entries()) {
    const f = filas.filter((x) => x.topic === slug);
    const port = f.filter((x) => !x.anchor);
    const solas = f.filter((x) => x.n <= 1).length;
    console.log(`| ${i + 1} | ${labels[slug] ?? slug} | ${f.length} | ${port.length} | ${f.length - port.length} | ${media(f).toFixed(2)} | ${f.length - solas} | ${solas} |`);
  }
  const port = filas.filter((x) => !x.anchor);
  const solas = filas.filter((x) => x.n <= 1).length;
  console.log(`| | **journey** | **${filas.length}** | **${port.length}** | **${filas.length - port.length}** | **${media(filas).toFixed(2)}** | **${filas.length - solas}** | **${solas}** |`);

  // Las plazas de VARIAS palabras ("en voz baja", "de par en par") no pueden
  // puntuar: el contador tokeniza el cuerpo en palabras sueltas y busca la
  // superficie entera, asi que siempre dan 0. Van aparte, no escondidas dentro
  // de "sale una sola vez".
  const multi = filas.filter((x) => x.multi);
  const uni = filas.filter((x) => !x.multi);
  console.log(`\nplazas de varias palabras: ${multi.length} de ${filas.length} · el contador no las puede puntuar (siempre 0)`);
  console.log(`media sobre las ${uni.length} de una sola palabra: ${media(uni).toFixed(2)}`);

  const dist: Record<string, number> = {};
  for (const x of filas) { const k = x.n >= 5 ? "5 o más" : String(x.n); dist[k] = (dist[k] ?? 0) + 1; }
  console.log(`\n| Sale en … cuerpos | 1 | 2 | 3 | 4 | 5 o más |`);
  console.log(`|---|---|---|---|---|---|`);
  console.log(`| plazas | ${["1","2","3","4","5 o más"].map((k) => dist[k] ?? 0).join(" | ")} |`);

  console.log(`\n| Journey | Nivel | Plazas | Historias por plaza | Solo una vez |`);
  console.log(`|---|---|---|---|---|`);
  for (const [id, et] of [
    ["cmqrtaj1p000032qtda86z6um", "Traveler ES/latam"], ["cmrr5hnbl000032k1esry5n8g", "Friends ES/spain"],
    ["cmsvz6mz9000732gsgsfer0ko", "Traveler ES/spain"], [A2, "**Traveler ES/spain (este)**"],
    ["cmt5x67ze000l320cpgunu5vi", "Traveler ES/spain"],
  ] as const) {
    const m = await mide(id);
    const s = m.filas.filter((x) => x.n <= 1).length;
    console.log(`| ${et} | ${(m.j.levels ?? []).join("+")} | ${m.filas.length} | ${media(m.filas).toFixed(2)} | ${Math.round((s / m.filas.length) * 100)}% |`);
  }

  const top = [...new Map(filas.map((x) => [x, x])).keys()];
  void top;
  const cuentas = new Map<string, number>();
  const st2 = await p.journeyStory.findMany({ where: { journeyId: A2, text: { not: null } }, select: { text: true, vocab: true } });
  const cu = st2.map((s) => tok(s.text!));
  for (const s of st2) for (const v of ((s.vocab as V[]) ?? [])) cuentas.set(clave(v), cu.filter((c) => c.has(clave(v))).length);
  const mejores = [...cuentas].sort((a, b) => b[1] - a[1]).slice(0, 12);
  console.log(`\nlas que más recirculan: ${mejores.map(([w, n]) => `${w} (${n})`).join(" · ")}`);
})().finally(() => p.$disconnect());
