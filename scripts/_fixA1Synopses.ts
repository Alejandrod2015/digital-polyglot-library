import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const J = "cmqp6hal8000032cb4ywfs0gc"; // ES LATAM A1

// slug -> { synopsis (A1 register), newSlug? }
const FIX: Record<string, { synopsis: string; newSlug?: string }> = {
  "sabado-de-mercado": { synopsis: "Es sábado y Sofía y Renata van al mercado a comprar fruta para el desayuno. ¿Mangos caros o plátanos baratos? Entre las dos eligen, sin prisa y de buen humor." },
  "no-hay-cafe": { synopsis: "El desayuno casi está listo, pero no queda café y la tienda abre en una hora. Cuando las dos amigas ya se resignan, alguien toca la puerta y llega un olor muy rico." },
  "mateo-trae-pan-dulce": { synopsis: "Quien toca la puerta es Mateo, con pan dulce de la panadería y el café que faltaba. El desayuno a medias se vuelve una mesa llena para tres." },
  "se-fue-la-luz": { synopsis: "Una tarde de lluvia en Bogotá, se va la luz en toda la casa. Sin internet ni teléfono, mamá saca unas velas y la tarde aburrida se vuelve la mejor parte del día." },
  "una-caja-vieja": { synopsis: "Limpiando un clóset, Marina encuentra una caja vieja con una foto en blanco y negro. La joven que baila en la foto es su mamá, y empieza una historia que nunca había oído." },
  "por-fin-se-abre-la-puerta": { synopsis: "Toda la mañana salen ruidos raros del cuarto de Julián, y no deja entrar a nadie. Cuando por fin abre la puerta, tiene un regalo hecho a mano para su mamá." },
  "cafe-para-dos": { synopsis: "Un sábado el café está lleno y solo queda una silla, al lado de un desconocido. Camila se sienta y, sin planearlo, conoce a Tomás, un chico del mismo barrio." },
  "quien-escribio-este-libro": { synopsis: "Camila visita la librería de Tomás para buscar cuentos para sus alumnos. Al abrir el libro que él le recomienda, descubre quién es en realidad ese vendedor tímido." },
  "las-nueve-y-cinco": { synopsis: "Camila invita a Tomás a leer su cuento en la escuela el viernes. Él acepta con miedo. Llega el día, los niños esperan, el reloj avanza y Tomás todavía no aparece." },
  "buscando-el-mar": { synopsis: "Diego está perdido en Lima y busca el mar con un mapa en la mano. Una vecina, Pilar, lo guía paso a paso. Lo que él no sabe es que el mar está a la vuelta de la esquina." },
  "el-micro-junto-al-mar": { synopsis: "Pilar y Diego alcanzan un micro que cruza uno de los barrios más bonitos de Lima. Desde la ventanilla ven la ciudad despertar, mientras don Beto los lleva hasta la plaza." },
  "una-fiesta-sin-aviso": { synopsis: "Pilar y Diego cruzan el centro para hacer un trámite aburrido. Al doblar una esquina se topan con una feria llena de música y color, y tienen que decidir si siguen o se quedan." },
  "el-barrio-se-prepara": { synopsis: "Daniela barre y cuelga cintas para una fiesta del barrio que siente ajena. Cuando Andrés le cuenta a quién celebran y todo lo que esa señora hizo por el vecindario, todo cambia." },
  "por-fin-empieza-la-fiesta": { synopsis: "La fiesta empieza y doña Rosa entra a su patio entre aplausos. Para Daniela es una desconocida; para Andrés, la mujer que lo cuidó de niño." },
  "alguien-toca-el-porton": { synopsis: "Doña Rosa va a apagar las velas cuando un golpe en el portón corta la música. Afuera espera un hombre con una maleta que pregunta por ella, y su voz le suena de hace mucho." },
  "lo-que-hay-tras-la-subida": { synopsis: "Javiera y Benjamín suben una montaña helada, cansados del frío y de la cuesta. Su tía Gloria les pide calma. Cuando el sendero se abre, lo que ven abajo los deja sin palabras." },
  "cuando-llega-la-tormenta": { synopsis: "A mitad del camino cae una tormenta y deja a Javiera y a Benjamín mojados y listos para volver. Gloria les pide solo unos minutos de paciencia bajo el árbol." },
  "nadie-quiere-dormir-todavia": { synopsis: "De noche, Benjamín enciende una fogata y el cielo se llena de estrellas. Entre el fuego y las historias de la tía Gloria, nadie tiene ganas de irse a dormir." },
  "la-luz-en-el-cerro": { synopsis: "Junto al fuego, la tía Lucha cuenta la leyenda de una luz que aparece de noche en el cerro. Itzel y Rodrigo suben a verla, y arriba encuentran algo muy distinto de un fantasma." },
  "el-animal-de-madera-se-mueve": { synopsis: "La tía Lucha les regala una figura de madera y dice, medio en broma, que de noche se mueve sola. A la mañana siguiente la figura mira hacia otro lado, y nadie la tocó." },
  "la-abuela-lo-confiesa-todo": { newSlug: "la-tia-lo-confiesa-todo", synopsis: "Los primos quieren resolver el misterio y encuentran a la tía Lucha pintando otra figura. Entre risas, ella confiesa la verdad y les enseña por qué inventa esas historias." },
};

(async () => {
  const p = new PrismaClient();
  const stories = await p.journeyStory.findMany({ where: { journeyId: J }, select: { id: true, slug: true } });
  const bySlug = new Map(stories.map(s => [s.slug ?? "", s]));
  let n = 0;
  for (const [slug, fix] of Object.entries(FIX)) {
    const s = bySlug.get(slug);
    if (!s) { console.log(`!! NO ENCONTRADO: ${slug}`); continue; }
    await p.journeyStory.update({ where: { id: s.id }, data: { synopsis: fix.synopsis, ...(fix.newSlug ? { slug: fix.newSlug } : {}) } });
    console.log(`ok ${fix.newSlug ? `${slug} -> ${fix.newSlug}` : slug}`);
    n++;
  }
  console.log(`\nActualizadas ${n}/21`);
  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
