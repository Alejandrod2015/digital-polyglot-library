/**
 * Siembra `cast` en las 21 historias del Traveler ES/Spain A2
 * (cmqc6tojm000032el2ebwsgkn). `cast` es la fuente de verdad para el prompt de
 * cover y para el casting de voces; estaba vacío en las 21, así que ni el cover
 * ni la selección de voz tenían de dónde leer edades y géneros.
 *
 * Las bandas de edad salen de lo que dice el propio texto, no de lo que
 * conviene: Carmiña lleva diciendo el conxuro "desde los quince" y fue amiga de
 * la madre de Sabela; Rosario plantó las flores "con diez años, hace treinta y
 * cinco". No se maquillan para esquivar la regla de no usar voces de anciano;
 * si un papel es mayor, se marca mayor y se decide aparte qué voz lo hace.
 *
 * NO toca title/slug/text/vocab/arcType/synopsis: eso solo entra por saveStory.ts.
 */
import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import { PrismaClient } from "../src/generated/prisma";
import type { CastMember } from "../src/lib/storyCast";

const prisma = new PrismaClient();
const JOURNEY = "cmqc6tojm000032el2ebwsgkn";
const apply = process.argv.includes("--apply");

const C = (name: string, role: string, ageBand: CastMember["ageBand"], gender: CastMember["gender"]): CastMember =>
  ({ name, role, ageBand, gender, present: true });

// Personajes recurrentes por hilo temático. Cada historia hereda los del hilo
// que realmente aparecen en ella (se filtra abajo por presencia en el texto).
const ROSTER: Record<string, CastMember[]> = {
  "community-celebrations": [
    C("Rocío", "sevillana que busca la caseta de su familia, con traje de flamenca", "young-adult", "f"),
    C("Curro", "amigo de Rocío, teme el ridículo delante de media Sevilla", "young-adult", "m"),
    C("Reme", "dueña de la caseta, anfitriona de toda su familia", "older-adult", "f"),
    C("Sobrino", "sobrino de Reme, llega tarde por el aparcamiento", "young-adult", "m"),
  ],
  "food-everyday-life": [
    C("Vicente", "tío valenciano, hace la paella con leña y sin prisa", "older-adult", "m"),
    C("Sergio", "sobrino, defiende el arroz rápido y el caldo comprado", "young-adult", "m"),
    C("Lucía", "hermana de Sergio, corta la discusión y propone la prueba", "young-adult", "f"),
    C("Pilar", "madre de Sergio y Lucía, cata la primera cuchara", "older-adult", "f"),
  ],
  "home-family": [
    C("Marta", "vive en el piso del Albaicín, cede su cuarto a Rosario", "young-adult", "f"),
    C("Hugo", "hermano de Marta, sube el baúl y pregunta por lo que pesa", "young-adult", "m"),
    C("Rosario", "dueña del piso, nació en el edificio y volvió a verlo", "adult", "f"),
    C("Andrés", "vecino de abajo, reclama por el agua que le cae al patio", "older-adult", "m"),
    C("Vecina", "vecina de la junta, recuerda a la madre de Rosario", "older-adult", "f"),
  ],
  "legends-folklore": [
    C("Sabela", "vuelve a la aldea gallega tras nueve años en la ciudad", "young-adult", "f"),
    C("Carmiña", "fue amiga de la madre de Sabela, recita el conxuro cada año", "elderly", "f"),
    C("Brais", "nunca se marchó de la aldea, nota el cambio en Sabela", "young-adult", "m"),
    C("Vecina", "sube con su farol a la queimada del pueblo", "adult", "f"),
  ],
  "meeting-new-people": [
    C("Elena", "recién llegada a Barcelona, tres semanas sin hablar con nadie", "young-adult", "f"),
    C("Marc", "responde al anuncio de intercambio, trabaja al lado de ella", "young-adult", "m"),
  ],
  "nature-adventure": [
    C("Nuria", "sobrina de ciudad, sube al lago en camiseta y baja guiando una vaca", "young-adult", "f"),
    C("Álvaro", "primo de Nuria, conoce el sendero y lo pierde con la niebla", "young-adult", "m"),
    C("Begoña", "tía asturiana, avisa del abrigo y espera con la linterna", "older-adult", "f"),
  ],
  "places-getting-around": [
    C("Clara", "cruza Madrid con una hora justa cuando se corta el metro", "young-adult", "f"),
    C("Paco", "portero del edificio, fue conserje quince años en esa misma calle", "older-adult", "m"),
    C("David", "vecino del cuarto, coge el cercanías cada mañana", "young-adult", "m"),
  ],
};

async function run() {
  const stories = await prisma.journeyStory.findMany({
    where: { journeyId: JOURNEY },
    select: { id: true, slug: true, topic: true, slotIndex: true, text: true, cast: true },
    orderBy: [{ topic: "asc" }, { slotIndex: "asc" }],
  });

  let written = 0;
  for (const s of stories) {
    const roster = ROSTER[s.topic] ?? [];
    const body = s.text ?? "";
    const present = roster.filter((c) => body.includes(c.name));
    const cast = { characters: present };
    const flag = present.some((c) => c.ageBand === "elderly" || c.ageBand === "older-adult") ? "  ← papel mayor" : "";
    console.log(
      `${s.slug.padEnd(28)} ${String(present.length).padStart(2)} personajes: ${present.map((c) => `${c.name}(${c.ageBand},${c.gender})`).join(", ")}${flag}`,
    );
    if (apply) {
      await prisma.journeyStory.update({ where: { id: s.id }, data: { cast } });
      written++;
    }
  }
  console.log(apply ? `\nescritas ${written} filas (solo columna cast)` : `\n(dry run; añade --apply para escribir)`);
  await prisma.$disconnect();
}
run().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
