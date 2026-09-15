import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();

const KEYS = [
  "porte","entre","ete","été","vis","place","tour","livre","pas","fait","bien",
  "sens","somme","sort","marche","ferme","avocat","a","il","elle","en","si",
  "tout","monde","café","encore","toujours","peu","là","quelque","contre",
  "côté","cher","dure","femme","lève","plaisir","au-dessus","juste","leur",
  "rien","bas","court","sent",
];

async function main() {
  const bundles = ["french-friends-a0", "french-friends-france-a1", "french-friends-france-a2"];
  for (const bundle of bundles) {
    const rows = await prisma.tapGlossSet.findMany({ where: { bundle }, select: { slug: true, glosses: true } });
    console.log(`\n===== ${bundle} (sin ";") =====`);
    for (const row of rows) {
      const glosses = row.glosses as Record<string, any>;
      for (const [key, v] of Object.entries(glosses)) {
        if (KEYS.includes(key.toLowerCase()) && v.g && !v.g.includes(";")) {
          console.log(`${row.slug || "(GLOBAL)"} | ${key}: g="${v.g}" t=${v.t} c=${v.c ? JSON.stringify(v.c) : ""}`);
        }
      }
    }
  }
}
main().finally(() => prisma.$disconnect());
