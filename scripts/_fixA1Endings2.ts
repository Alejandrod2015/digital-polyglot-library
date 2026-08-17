import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const J = "cmqp6hal8000032cb4ywfs0gc"; // ES LATAM A1

type Pair = [string, string];
// old = string currently in DB (from pass 1); new = v2 that re-includes the vocab surfaces
const REPL: { slug: string; pairs: Pair[] }[] = [
  { slug: "se-fue-la-luz", pairs: [
    ["Los tres se sientan cerca de la vela. Afuera sigue la lluvia; adentro, la luz amarilla tiembla en la pared.",
     "Al final, los tres se sientan cerca de la vela. Afuera sigue la lluvia; adentro, la luz amarilla es suave y cálida."],
  ]},
  { slug: "una-caja-vieja", pairs: [
    ["Mamá: Otro día te cuento de él. Hoy te hablo de la música y del baile.",
     "Mamá: De ese muchacho te cuento otro día. Mañana volvemos a limpiar."],
  ]},
  { slug: "por-fin-se-abre-la-puerta", pairs: [
    ["Mamá se sienta en la silla y la mece despacio, con la mano sobre la madera.",
     "Mamá se sienta en la silla y la mece despacio. Marina abraza a su hermano, todavía sorprendida."],
    ["Julián: Tres semanas guardé el secreto. Casi no aguanto.",
     "Julián: Valió la pena cada hora de trabajo. Ya quería ver tu cara."],
  ]},
  { slug: "buscando-el-mar", pairs: [
    ["Diego camina hasta el borde del parque. De golpe todo se abre frente a él: el mar azul, justo abajo del malecón, con el viento fresco en la cara.",
     "Diego camina hasta el borde del parque. De golpe todo se abre frente a él: el mar azul, justo abajo del malecón. La vista es enorme y el viento llega fresco a la cara."],
  ]},
  { slug: "el-micro-junto-al-mar", pairs: [
    ["Diego paga el pasaje y los dos bajan en la plaza. El mar se oye cerca, detrás de las casas de colores.",
     "Diego paga el pasaje y los dos bajan en la parada de la plaza. El mar se oye más o menos cerca, detrás de las casas de colores."],
    ["Pilar: Por aquí se baja a la playa. Todavía nos falta un pedacito.",
     "Pilar: Por aquí se baja a la playa. Llegamos sin correr y sin perdernos."],
    ["Diego: Entonces caminemos. Quiero ver el mar de cerca de una vez.",
     "Diego: Entonces caminemos. Quiero terminar el paseo en la arena."],
  ]},
  { slug: "por-fin-empieza-la-fiesta", pairs: [
    ["Todos aplauden y la música vuelve más fuerte. Daniela canta el coro que esta mañana no conocía.",
     "Todos aplauden y empiezan a cantar. Daniela canta su parte de la canción y siente el patio entero a su lado."],
  ]},
  { slug: "cuando-llega-la-tormenta", pairs: [
    ["Benjamín: La próxima vez te hago caso desde el principio, tía.",
     "Benjamín: Voy a recordar esto. Esperar un poco valió la pena."],
  ]},
  { slug: "nadie-quiere-dormir-todavia", pairs: [
    ["Gloria toma un palito y mueve la leña. El fuego sube y los tres se acercan más.",
     "Gloria mueve la leña y el fuego sube. Los tres se quedan un rato en silencio, felices, mirando las estrellas."],
    ["Gloria: Bueno, les cuento la del lago. Mi papá me la contó aquí mismo.",
     "Gloria: Bueno, les cuento la del lago. Pero guarda bien esta historia, Javiera."],
    ["Benjamín: Échale más leña entonces, que esa va a ser larga.",
     "Benjamín: Le echo más leña entonces. Nunca dormí con tanta paz como aquí."],
  ]},
];

const wc = (t: string) => (t.trim().match(/[A-Za-zÁÉÍÓÚÑáéíóúñü0-9]+/g) ?? []).length;

(async () => {
  const p = new PrismaClient();
  const stories = await p.journeyStory.findMany({ where: { journeyId: J }, select: { id: true, slug: true, text: true, vocab: true } });
  const bySlug = new Map(stories.map(s => [s.slug ?? "", s]));
  let errors = 0;
  for (const { slug, pairs } of REPL) {
    const s = bySlug.get(slug);
    if (!s || !s.text) { console.log(`!! NO ENCONTRADO/SIN TEXTO: ${slug}`); errors++; continue; }
    let text = s.text;
    for (const [oldS, newS] of pairs) {
      const idx = text.indexOf(oldS);
      if (idx === -1) { console.log(`!! NO MATCH en ${slug}: "${oldS.slice(0, 55)}..."`); errors++; continue; }
      text = text.replace(oldS, newS);
    }
    const vocab: any[] = Array.isArray(s.vocab) ? (s.vocab as any[]) : [];
    const low = text.toLowerCase();
    const missing = vocab.filter(v => { const surf = String(v.surface ?? v.word ?? "").toLowerCase().trim(); return surf && !low.includes(surf); }).map(v => v.surface ?? v.word);
    await p.journeyStory.update({ where: { id: s.id }, data: { text, wordCount: wc(text) } });
    console.log(`ok ${slug} (words=${wc(text)})${missing.length ? `  ⚠ aún fuera: ${JSON.stringify(missing)}` : "  ✓ vocab completo"}`);
  }
  console.log(`\n${errors ? `ERRORES: ${errors}` : "Sin errores de match"}`);
  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
