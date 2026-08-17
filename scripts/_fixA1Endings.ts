import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const J = "cmqp6hal8000032cb4ywfs0gc"; // ES LATAM A1

type Pair = [string, string];
const REPL: { slug: string; pairs: Pair[] }[] = [
  { slug: "se-fue-la-luz", pairs: [
    ["Los tres se sientan juntos. Afuera sigue la lluvia, pero adentro la tarde se vuelve cálida.",
     "Los tres se sientan cerca de la vela. Afuera sigue la lluvia; adentro, la luz amarilla tiembla en la pared."],
    ["Marina: Al final, quedarnos sin luz no estuvo tan mal.",
     "Marina: Sí, mamá, cuéntanos una de cuando eras niña."],
    ["Julián: Igual cargo el teléfono mañana. Hoy lo dejo apagado y ya.",
     "Julián: Y mañana cargo el teléfono. Hoy lo dejo apagado."],
  ]},
  { slug: "una-caja-vieja", pairs: [
    ["Marina deja la caja a un lado. El clóset puede esperar; ahora quiere oír cada historia.",
     "Marina deja la caja en el suelo y se sienta al lado de su mamá."],
    ["Marina: El cuarto sigue sucio, pero esto es más importante.",
     "Marina: ¿De verdad no me cuentas quién es ese muchacho de la foto?"],
    ["Mamá: Tienes razón. Mañana limpiamos; hoy quiero ver esas fotos contigo.",
     "Mamá: Otro día te cuento de él. Hoy te hablo de la música y del baile."],
  ]},
  { slug: "por-fin-se-abre-la-puerta", pairs: [
    ["Mamá se sienta y pasa la mano por la madera. Marina abraza a su hermano, contenta.",
     "Mamá se sienta en la silla y la mece despacio, con la mano sobre la madera."],
    ["Marina: Por eso tanto secreto. Eres increíble, Julián.",
     "Marina: Con razón no nos dejabas entrar. Mira cómo te quedó la silla."],
    ["Julián: Solo quería ver tu sonrisa. Valió la pena.",
     "Julián: Tres semanas guardé el secreto. Casi no aguanto."],
  ]},
  { slug: "cafe-para-dos", pairs: [
    ["Camila prueba su café y sonríe. Sin buscarlo, el sábado le regaló un buen rato.",
     "Camila prueba su café, que todavía está caliente, y siguen conversando un rato más."],
    ["Tomás: Bueno, ya sabés dónde encontrarme.",
     "Tomás: Bueno, ya sabés dónde encontrarme. La librería abre todos los días."],
    ["Camila: Claro que sí. Paso un día de estos. Gracias por la silla.",
     "Camila: Me paso un día de estos, entonces. Gracias por la silla."],
  ]},
  { slug: "buscando-el-mar", pairs: [
    ["Diego camina hasta el borde del parque. De golpe, todo se abre frente a él en una vista enorme: el mar azul, justo abajo del malecón.",
     "Diego camina hasta el borde del parque. De golpe todo se abre frente a él: el mar azul, justo abajo del malecón, con el viento fresco en la cara."],
    ["Pilar: ¿Ves? Estaba aquí cerquita. Ahora ya sabes llegar solo.",
     "Pilar: Estaba aquí, detrás del parque. Baja a la arena y métete hasta la orilla."],
  ]},
  { slug: "el-micro-junto-al-mar", pairs: [
    ["Diego paga el pasaje y los dos bajan en la parada. El mar se oye más o menos cerca, detrás de las casas.",
     "Diego paga el pasaje y los dos bajan en la plaza. El mar se oye cerca, detrás de las casas de colores."],
    ["Pilar: ¿Ves? Llegamos sin perdernos y sin correr.",
     "Pilar: Por aquí se baja a la playa. Todavía nos falta un pedacito."],
    ["Diego: Sí. Y todavía no llegamos al mar; el paseo apenas empieza.",
     "Diego: Entonces caminemos. Quiero ver el mar de cerca de una vez."],
  ]},
  { slug: "el-barrio-se-prepara", pairs: [
    ["Daniela acomoda las flores y sonríe. Ahora ella también quiere que la fiesta salga perfecta.",
     "Daniela acomoda las flores en el florero y se queda mirando el patio lleno de luces."],
  ]},
  { slug: "por-fin-empieza-la-fiesta", pairs: [
    ["Todos aplauden y empiezan a cantar. Daniela siente que, en una sola tarde, ya es parte del barrio.",
     "Todos aplauden y la música vuelve más fuerte. Daniela canta el coro que esta mañana no conocía."],
  ]},
  { slug: "lo-que-hay-tras-la-subida", pairs: [
    ["Gloria: Así es la montaña. El camino cansa, pero el premio es grande.",
     "Gloria: Así es la montaña. Primero cansa y después regala esto."],
    ["Javiera: Ya casi no siento el frío. Solo quiero quedarme aquí a mirar el agua.",
     "Javiera: Ya casi no siento el frío. Me quedo un rato más a mirar el agua."],
    ["Benjamín: Yo igual. Ninguna foto puede mostrar todo esto.",
     "Benjamín: Yo saco una foto, aunque sé que no va a salir igual."],
    ["Javiera: Subimos sin ganas y mira cómo terminamos.",
     "Javiera: Igual me la quedo, para acordarme de este día."],
  ]},
  { slug: "cuando-llega-la-tormenta", pairs: [
    ["Salen de su árbol y siguen el camino con cuidado. Quedarse esos minutos valió la pena.",
     "Salen de su árbol y siguen el camino entre charcos, con el sol otra vez afuera."],
    ["Benjamín: Lo voy a recordar la próxima vez que quiera volver al pueblo.",
     "Benjamín: La próxima vez te hago caso desde el principio, tía."],
  ]},
  { slug: "nadie-quiere-dormir-todavia", pairs: [
    ["Gloria sonríe y mira el fuego. Los tres se quedan en silencio, felices, bajo el cielo abierto.",
     "Gloria toma un palito y mueve la leña. El fuego sube y los tres se acercan más."],
    ["Javiera: No quiero que esta noche se termine nunca.",
     "Javiera: Cuéntanos una historia, tía. La noche todavía es larga."],
    ["Gloria: Guárdala bien. Yo todavía recuerdo las noches que pasé aquí de niña.",
     "Gloria: Bueno, les cuento la del lago. Mi papá me la contó aquí mismo."],
    ["Benjamín: Esta no la olvido. Tanta estrella y tanta paz junta.",
     "Benjamín: Échale más leña entonces, que esa va a ser larga."],
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
      if (idx === -1) { console.log(`!! NO MATCH en ${slug}:\n   "${oldS.slice(0, 60)}..."`); errors++; continue; }
      if (text.indexOf(oldS, idx + 1) !== -1) { console.log(`!! MATCH AMBIGUO en ${slug}: "${oldS.slice(0,40)}"`); errors++; continue; }
      text = text.replace(oldS, newS);
    }
    // vocab coverage check
    const vocab: any[] = Array.isArray(s.vocab) ? (s.vocab as any[]) : [];
    const low = text.toLowerCase();
    const missing = vocab.filter(v => {
      const surf = String(v.surface ?? v.word ?? "").toLowerCase().trim();
      return surf && !low.includes(surf);
    }).map(v => v.surface ?? v.word);
    await p.journeyStory.update({ where: { id: s.id }, data: { text, wordCount: wc(text) } });
    console.log(`ok ${slug}  (words=${wc(text)})${missing.length ? `  ⚠ vocab fuera del cuerpo: ${JSON.stringify(missing)}` : ""}`);
  }
  console.log(`\n${errors ? `ERRORES: ${errors}` : "Sin errores de match"}`);
  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
