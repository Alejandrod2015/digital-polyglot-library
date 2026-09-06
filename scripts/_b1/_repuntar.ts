/** Los dos temas de pueblo se renombraron. Estas seis filas siguen colgadas de
 *  los slugs viejos, que ya no estan en el array del journey, y ademas su
 *  vocabulario bloquea al de las historias nuevas porque `saveStory` empareja
 *  por `tema#hueco`. Se repuntan al slug nuevo para que la tanda las sustituya.
 *  Solo se toca `topic`; el texto y el vocabulario se quedan como estan hasta
 *  que `saveStory` los reescriba. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const MAPA: Record<string, string> = {
  "winter-and-empty-houses": "rooms-and-landlords",
  "storms-and-the-sea": "meetings-and-deadlines",
};
(async () => {
  const p = new PrismaClient();
  for (const [viejo, nuevo] of Object.entries(MAPA)) {
    const r = await p.journeyStory.updateMany({
      where: { journeyId: "cmt5x67ze000l320cpgunu5vi", topic: viejo },
      data: { topic: nuevo },
    });
    console.log(`${viejo} -> ${nuevo}: ${r.count} filas`);
  }
  await p.$disconnect();
})();
