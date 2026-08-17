import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
const J = "cmovi4cvi000032q37a4823h3";

// Per-slug surgical replacements [old, new]. Preserve all vocab tokens + dialogue.
const EDITS: Record<string, [string, string][]> = {
  // ---- community-celebrations: drop redundant city re-announce (slot 3) ----
  "alguien-toca-el-porton": [
    ["alguien golpea el portón de hierro. En Cartagena, Colombia, la fiesta queda en silencio de pronto. Andrés y Daniela miran hacia la reja.",
     "alguien golpea el portón de hierro. De pronto la fiesta queda en silencio. Andrés y Daniela miran hacia la reja."],
  ],
  // ---- home-family ----
  "una-caja-vieja": [
    ["saca una caja con polvo. Es sábado en Bogotá, Colombia, y ayuda a su mamá a ordenar el cuarto.",
     "saca una caja con polvo. Es sábado y ayuda a su mamá a ordenar el cuarto."],
    ["Mamá: Tienes razón. Limpiar la casa también trae recuerdos.",
     "Mamá: Tienes razón. Mañana limpiamos; hoy quiero ver esas fotos contigo."],
  ],
  "se-fue-la-luz": [
    ["Julián: No. A veces lo mejor llega cuando se apaga el teléfono.",
     "Julián: Igual cargo el teléfono mañana. Hoy lo dejo apagado y ya."],
  ],
  "por-fin-se-abre-la-puerta": [
    ["ruidos en el cuarto de Julián. Es domingo en Bogotá, Colombia, y Marina y su mamá no saben qué pasa.",
     "ruidos en el cuarto de Julián. Es domingo y Marina y su mamá no saben qué pasa."],
  ],
  // ---- legends-folklore: abuela -> Tía Lucha consistency in slot 2 ----
  "el-animal-de-madera-se-mueve": [
    ["La abuela les regala una figura de madera pintada de muchos colores. En Oaxaca, México, dicen que estas figuras cuidan la casa por la noche.",
     "La tía Lucha les regala una figura de madera pintada de muchos colores. Dicen que estas figuras cuidan la casa por la noche."],
    ["Rodrigo: La abuela dijo que se mueve cuando nadie mira.",
     "Rodrigo: La tía Lucha dijo que se mueve cuando nadie mira."],
    ["Afuera, la abuela canta en el patio como si nada pasara.",
     "Afuera, la tía Lucha canta en el patio como si nada pasara."],
    ["Itzel: Vamos a preguntarle a la abuela. Ella tiene que saber algo.",
     "Itzel: Vamos a preguntarle a la tía. Ella tiene que saber algo."],
  ],
  // ---- meeting-new-people ----
  "quien-escribio-este-libro": [
    ["suena una campana. En el centro de Buenos Aires, Argentina, el local abre temprano. Detrás del mostrador, Tomás la saluda con una sonrisa.",
     "suena una campana. El local abre temprano y, detrás del mostrador, Tomás la saluda con una sonrisa."],
    ["El vendedor tímido es, en realidad, alguien con un sueño cumplido.",
     "El vendedor tímido escribió el libro que ella tiene en las manos."],
  ],
  "las-nueve-y-cinco": [
    ["Es Camila, desde su escuela en Buenos Aires, Argentina, con una idea entre manos.",
     "Es Camila, que llama desde su escuela con una idea entre manos."],
  ],
  // ---- nature-adventure ----
  "nadie-quiere-dormir-todavia": [
    ["Benjamín enciende una fogata. En Patagonia, Chile, las estrellas llenan todo el cielo. Javiera y su tía Gloria se acercan al fuego con sus tazas.",
     "Benjamín enciende una fogata. Las estrellas llenan todo el cielo, y Javiera y su tía Gloria se acercan al fuego con sus tazas."],
    ["Gloria: Guarda este momento bien adentro. Estas cosas no se olvidan.",
     "Gloria: Guárdala bien. Yo todavía recuerdo las noches que pasé aquí de niña."],
    ["Benjamín: Yo ya no lo olvido más. Esto es pura paz.",
     "Benjamín: Esta no la olvido. Tanta estrella y tanta paz junta."],
  ],
  "cuando-llega-la-tormenta": [
    ["Gloria: En la montaña gana el que espera un poco más que los otros.",
     "Gloria: Te lo dije. La tormenta de montaña siempre pasa rápido."],
  ],
  // ---- places-getting-around ----
  "buscando-el-mar": [
    ["Pilar: Así es esta ciudad. El mar siempre está más cerca de lo que crees.",
     "Pilar: ¿Ves? Estaba aquí cerquita. Ahora ya sabes llegar solo."],
  ],
  "el-micro-junto-al-mar": [
    ["logran subir. En Lima, Perú, el viaje cuesta poco y dura un buen rato. Don Beto, el señor que maneja, los saluda por el espejo.",
     "logran subir. El viaje cuesta poco y dura un buen rato. Don Beto, el señor que maneja, los saluda por el espejo."],
    ["Diego: Sí. A veces el viaje es la mejor parte del paseo.",
     "Diego: Sí. Y todavía no llegamos al mar; el paseo apenas empieza."],
  ],
  "una-fiesta-sin-aviso": [
    ["Pilar y Diego buscan la calle Unión en el centro de Lima, Perú. Doblan en una esquina",
     "Pilar y Diego buscan la calle Unión por el centro. Doblan en una esquina"],
    ["Pilar: Así es Lima. A veces lo mejor te encuentra a ti.",
     "Pilar: Y eso que el mandado era para salir rápido."],
  ],
};

(async () => {
  const apply = process.argv.includes("--apply");
  let totalMiss = 0;
  for (const [slug, reps] of Object.entries(EDITS)) {
    const s = await prisma.journeyStory.findFirst({ where: { journeyId: J, slug }, select: { id: true, text: true, audioUrl: true } });
    if (!s?.text) { console.log(`  ${slug}: NOT FOUND`); continue; }
    if (s.audioUrl) { console.log(`  ${slug}: TIENE AUDIO; skip`); continue; }
    let text = s.text;
    let miss = 0;
    for (const [oldS, newS] of reps) {
      if (!text.includes(oldS)) { console.log(`  !! MISS ${slug}: "${oldS.slice(0, 55)}..."`); miss++; totalMiss++; continue; }
      text = text.replace(oldS, newS);
    }
    const wc = text.trim().split(/\s+/).length;
    if (!apply) { console.log(`  [dry] ${slug}: ${reps.length - miss}/${reps.length} reps ok -> ${wc}w`); continue; }
    if (miss === 0) {
      await prisma.journeyStory.update({ where: { id: s.id }, data: { text, wordCount: wc } });
      console.log(`  UPDATED ${slug} (${wc}w, ${reps.length} reps)`);
    } else {
      console.log(`  SKIP ${slug} (tiene ${miss} miss, no escribo)`);
    }
  }
  if (totalMiss) console.log(`\n⚠ ${totalMiss} reemplazos no matchearon; revisar antes de --apply`);
  await prisma.$disconnect();
})().catch((e) => { console.log("FATAL", e.message); process.exit(1); });
