/**
 * Arregla lo que salió al LEER los 419 ejercicios como los ve quien practica.
 * Son dos clases de fallo, y ninguna la ve `_validateSets.ts`:
 *
 *  A) Gramática rota en dos frases mías ("La familia comen", "dice que ella
 *     me ocupo de"), por meter a la fuerza la forma que guarda el vocab.
 *  B) `fill_blank` NO determinados: la regla dura del spec es que se resuelvan
 *     por significado, y en 16 de los 101 encajaban dos o más opciones. "Los
 *     zapatos me quedan pequeños / grandes, necesito otra talla" es válido con
 *     las dos. Reescribo la pista para que solo quepa una.
 *
 * De paso deshago dos marcos duplicados entre sets (el gato durmiendo aparecía
 * dos veces con respuestas opuestas, debajo y encima; y "han abierto un bar
 * nuevo" se repetía con la panadería).
 */
import * as fs from "fs";

type Fill = {
  slug: string; word: string; why: string;
  sentence: string; translation: string; optionTranslations?: string[]; options?: string[];
};
type Mean = { slug: string; word: string; why: string; sentence: string; clip: string };

const MEAN_FIXES: Mean[] = [
  {
    slug: "apuntado-tio", word: "comen",
    why: "'La familia comen' es incorrecto: sujeto singular, verbo plural",
    sentence: "Todos [[comen]] despacio durante toda la tarde.",
    clip: "Todos comen despacio durante toda la tarde.",
  },
  {
    slug: "otra-vez-gotea-abajo", word: "me ocupo de",
    why: "'Rosario dice que ella me ocupo de' mezcla tercera y primera persona; en estilo directo se arregla solo",
    sentence: "Rosario zanja el tema: yo [[me ocupo de]] la junta.",
    clip: "Rosario zanja el tema: yo me ocupo de la junta.",
  },
];

const FILL_FIXES: Fill[] = [
  { slug: "esa-nina-soy-yo", word: "sentado", why: "sentado, dormido y cansado encajaban los tres en un banco del parque",
    sentence: "Hay poco sitio: mi padre está _____ y yo de pie.",
    translation: "There is little room: my father is _____ and I am standing." },
  { slug: "esa-nina-soy-yo", word: "debajo", why: "un gato duerme encima de la cama tan bien como debajo",
    sentence: "El gato se esconde _____ de la cama cuando llaman.",
    translation: "The cat hides _____ the bed when somebody rings." },
  { slug: "otra-vez-gotea-abajo", word: "tranquila", why: "nerviosa, ocupada y sorprendida encajaban igual tras una conversación",
    sentence: "Estaba nerviosa, pero al hablar con él se quedó _____.",
    translation: "She was nervous, but after talking to him she felt _____." },
  { slug: "levanta-el-arroz", word: "blando", why: "la pista de la talla admitía pequeños y grandes por igual",
    sentence: "El pan de ayer ya no está _____, hay que mojarlo.",
    translation: "Yesterday's bread is not _____ any more, you have to dip it." },
  { slug: "levanta-el-arroz", word: "pequeños", why: "unos zapatos que piden otra talla pueden ser pequeños o grandes",
    sentence: "Los zapatos me quedan _____, me aprietan los dedos.",
    translation: "The shoes are too _____ for me, they squeeze my toes." },
  { slug: "otra-vez-gotea-abajo", word: "fuerte", why: "'no oigo nada' funcionaba también con la música baja, y encima confundía",
    sentence: "La música está muy _____, tengo que gritar para hablar.",
    translation: "The music is very _____, I have to shout to talk." },
  { slug: "otra-vez-gotea-abajo", word: "lavar", why: "guardar los platos antes de salir es igual de válido",
    sentence: "Tengo que _____ los platos, están llenos de aceite.",
    translation: "I have to _____ the dishes, they are covered in oil." },
  { slug: "algo-mejor-que-el-oro", word: "noche", why: "'esa semana no pude dormir' encajaba igual",
    sentence: "Esa _____ no pude dormir y vi amanecer.",
    translation: "That _____ I could not sleep and I saw the sun come up." },
  { slug: "algo-mejor-que-el-oro", word: "cerrado", why: "un museo puede estar abierto los lunes por la mañana",
    sentence: "El museo está _____ los lunes, no se puede entrar.",
    translation: "The museum is _____ on Mondays, you cannot go in." },
  { slug: "quiero-tener-mis-sitios", word: "encima", why: "mismo marco del gato que en otro set y con la respuesta contraria; y debajo encajaba igual",
    sentence: "Los libros están _____ de la mesa, no debajo.",
    translation: "The books are _____ the table, not underneath." },
  { slug: "se-apaga-la-llama", word: "quince", why: "cuatro y treinta encajaban igual en un cumpleaños",
    sentence: "Tiene _____ años: ya no es niña, pero aún no vota.",
    translation: "She is _____: not a child any more, but she cannot vote yet." },
  { slug: "por-algo-se-empieza", word: "roja", why: "una chaqueta de invierno puede ser de cualquier color",
    sentence: "Marc lleva una bufanda _____, del color de un tomate.",
    translation: "Marc wears a _____ scarf, the colour of a tomato." },
  { slug: "por-algo-se-empieza", word: "pocos", why: "'quedan muchos días para las vacaciones' es igual de válido",
    sentence: "Quedan _____ días, casi no hay tiempo.",
    translation: "There are _____ days left, there is hardly any time." },
  { slug: "la-bufanda-nunca-falla", word: "misma", why: "sin referente previo, otra y próxima encajaban igual",
    sentence: "Tú en el doce y yo en el catorce: la _____ calle.",
    translation: "You at number twelve and me at fourteen: the _____ street." },
  { slug: "no-se-ve-un-palmo", word: "quietos", why: "sentados y juntos encajaban con escuchar con atención",
    sentence: "Nos quedamos _____, sin mover ni un pie.",
    translation: "We stayed _____, without moving a single foot." },
  { slug: "no-se-ve-un-palmo", word: "oficina", why: "una tienda o una fábrica pequeña también son de cinco personas",
    sentence: "Trabajo en una _____ con cinco mesas y cinco ordenadores.",
    translation: "I work in an _____ with five desks and five computers." },
  { slug: "el-mundo-es-un-panuelo", word: "nueva", why: "mismo marco de 'han abierto un X nuevo' que en otro set",
    sentence: "Esta panadería es _____, abrió la semana pasada.",
    translation: "This bakery is _____, it opened last week." },
];

const wc = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
let touched = 0;

for (const f of MEAN_FIXES) {
  const p = `scripts/_sets/${f.slug}.json`;
  const d = JSON.parse(fs.readFileSync(p, "utf8")) as Record<string, unknown>[];
  const ex = d.find((e) => e.word === f.word);
  if (!ex) throw new Error(`${f.slug}: no encuentro '${f.word}'`);
  if (!f.sentence.includes(`[[${f.word}]]`)) throw new Error(`${f.slug}: falta el marcado de '${f.word}'`);
  ex.sentence = f.sentence;
  (ex.payload as Record<string, unknown>).audioClip = {
    ...((ex.payload as Record<string, unknown>).audioClip as Record<string, unknown>), sentence: f.clip,
  };
  console.log(`${f.slug} · ${f.word} [gramática]\n  ${f.why}\n  ahora: ${f.sentence}\n`);
  fs.writeFileSync(p, JSON.stringify(d, null, 1) + "\n");
  touched++;
}

for (const f of FILL_FIXES) {
  const p = `scripts/_sets/${f.slug}.json`;
  const d = JSON.parse(fs.readFileSync(p, "utf8")) as Record<string, unknown>[];
  const ex = d.find((e) => e.word === f.word && e.type === "fill_blank");
  if (!ex) throw new Error(`${f.slug}: no encuentro el fill '${f.word}'`);
  if (!f.sentence.includes("_____")) throw new Error(`${f.slug}/${f.word}: falta el hueco`);
  if (wc(f.sentence) > 12) throw new Error(`${f.slug}/${f.word}: ${wc(f.sentence)} palabras, tope 12`);
  if (!f.translation.includes("_____")) throw new Error(`${f.slug}/${f.word}: la traducción debe conservar el hueco`);
  const pay = ex.payload as Record<string, unknown>;
  ex.sentence = f.sentence;
  pay.translation = f.translation;
  if (f.options) pay.options = f.options;
  if (f.optionTranslations) pay.optionTranslations = f.optionTranslations;
  const answer = String(pay.answer);
  pay.audioClip = {
    ...(pay.audioClip as Record<string, unknown>),
    sentence: f.sentence.replace("_____", answer),
  };
  console.log(`${f.slug} · ${f.word} [no determinado]\n  ${f.why}\n  ahora: ${f.sentence}\n`);
  fs.writeFileSync(p, JSON.stringify(d, null, 1) + "\n");
  touched++;
}

console.log(`${touched} ejercicios corregidos`);
