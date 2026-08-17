import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
const J = "cmovi4cvi000032q37a4823h3";

const UPDATES: { slug: string; title?: string; text: string }[] = [
  {
    slug: "las-nueve-y-cinco",
    text: `Suena el teléfono en la librería y Tomás contesta. Es Camila, desde su escuela en Buenos Aires, Argentina, con una idea entre manos.

Camila: Tomás, tengo un plan. ¿Tenés un minuto?
Tomás: Para vos siempre tengo tiempo. ¿De qué se trata?
Camila: ¿Querés venir el viernes? Podés leerles tu cuento a los chicos.
Tomás: ¿Yo? ¿Leer delante de toda una clase?

Tomás: Me da miedo, Camila. Nunca leí mi libro en voz alta.
Camila: Por eso mismo. Va a ser un día distinto para todos.
Tomás: ¿Y si lo hago mal? ¿Y si no les gusta nada?
Camila: Les va a encantar. Yo voy a estar a tu lado.

Tomás se queda callado un momento. Mira los libros y respira hondo.

Tomás: Está bien. Lo voy a hacer. El viernes por la mañana.
Camila: ¡Qué bueno! Te espero a las nueve en la puerta.
Tomás: Ahí voy a estar, aunque ya estoy nervioso.

Llega el viernes. Camila espera afuera con sus alumnos y mira la calle una y otra vez. Son las nueve y cinco, y Tomás todavía no aparece.

Camila: Ya casi son las nueve y diez. ¿Le habrá pasado algo?

Uno de sus alumnos le tira de la manga y le pregunta si el señor va a venir o no.`,
  },
  {
    slug: "la-luz-en-el-cerro",
    text: `Esta noche, la tía Lucha cuenta una vieja leyenda junto al fuego. En Oaxaca, México, sus sobrinos Itzel y Rodrigo escuchan con los ojos muy abiertos. La historia habla de una luz que aparece en el cerro.

Tía Lucha: Dicen que esa luz ayuda a los viajeros perdidos.
Rodrigo: ¿Y si no es buena? Esas historias me asustan.
Itzel: No tengas miedo. Yo quiero ver esa luz.
Tía Lucha: Pues miren por la ventana. Justo ahora brilla en la colina.

Los dos sobrinos corren a la ventana. Una luz pequeña se mueve despacio por el cerro oscuro.

Rodrigo: ¡Es verdad! ¿Quién anda ahí a esta hora?
Itzel: Vamos a ver. Tú trae la linterna y yo voy adelante.
Rodrigo: ¿Estás segura? ¿Y si es algo malo?
Itzel: Sé valiente. Solo así vamos a saberlo.

Suben con cuidado y la sombra crece a su lado. Arriba hay un hombre viejo con una lámpara.

Don Pedro: Buenas noches, niños. ¿Ustedes también se perdieron?
Itzel: No, señor. Seguimos su luz desde la casa.
Rodrigo: ¿Usted es la luz de la leyenda? Pensé que era algo malo.
Don Pedro: Solo soy un viejo con su lámpara. La leyenda la pusieron ustedes.
Itzel: ¿Y por qué sube cada noche hasta aquí arriba?
Don Pedro: Subo a poner una luz. Así nadie se pierde en lo oscuro.

La tía Lucha los espera abajo, tranquila. La luz del cerro tenía dueño, y era don Pedro con su lámpara de siempre.`,
  },
  {
    slug: "la-abuela-lo-confiesa-todo",
    title: "La tía lo confiesa todo",
    text: `Por la mañana, los primos encuentran a su tía Lucha pintando otra figura en el patio. En Oaxaca, México, el sol entra tibio entre las plantas. Itzel y Rodrigo se sientan a su lado.

Rodrigo: Tía, dinos la verdad. ¿La figura se mueve sola?
Tía Lucha: Ay, mis niños. La que mueve las figuras soy yo.
Itzel: ¿Tú? ¿Entonces no hay nada raro en todo esto?
Tía Lucha: No, ningún misterio. Lo bonito es otra cosa.

La tía Lucha ríe despacio y sigue pintando con su pincel.

Tía Lucha: Yo muevo la figura para que ustedes pregunten por ella.
Rodrigo: O sea que el animalito era una excusa para hablar.
Tía Lucha: Así es. Una leyenda vive solo si alguien la cuenta.
Itzel: Quiero aprender. Enséñame a pintar una figura, tía.

La tía Lucha les pasa un pincel y un poco de pintura a cada uno. Los tres pintan juntos, despacio, bajo el sol de la mañana.

Rodrigo: La mía va a cuidar mi cuarto allá en la ciudad.
Itzel: Y la mía va a guardar esta historia para siempre, aquí contigo.
Tía Lucha: Me parece bien. El año que viene pintamos otra figura.`,
  },
];

(async () => {
  const apply = process.argv.includes("--apply");
  for (const u of UPDATES) {
    const s = await prisma.journeyStory.findFirst({ where: { journeyId: J, slug: u.slug }, select: { id: true, audioUrl: true } });
    if (!s) { console.log(`  ${u.slug}: NOT FOUND`); continue; }
    if (s.audioUrl) { console.log(`  ${u.slug}: TIENE AUDIO; abortar (no piso audio)`); continue; }
    const wc = u.text.trim().split(/\s+/).length;
    if (!apply) { console.log(`  [dry] ${u.slug} -> ${wc}w${u.title ? ` | title="${u.title}"` : ""}`); continue; }
    await prisma.journeyStory.update({ where: { id: s.id }, data: { text: u.text, wordCount: wc, ...(u.title ? { title: u.title } : {}) } });
    console.log(`  UPDATED ${u.slug} (${wc}w)${u.title ? ` title="${u.title}"` : ""}`);
  }
  await prisma.$disconnect();
})().catch((e) => { console.log("FATAL", e.message); process.exit(1); });
