// Cruza candidatas de vocab del Friends FR A0 contra TODO el vocab frances
// (Expat, Traveler archivado y el propio journey, marcado /ESTE).
//   npx tsx scripts/_frA0VocabCheck.ts
import "dotenv/config";
import { PrismaClient } from "@/generated/prisma";
import { FRENCH_A1_A2_LEMMAS } from "@/lib/cefr/frenchA1A2";
const p = new PrismaClient();
const ESTE = "cmtwo6cys0007j8yzg6ni3fsc";
const strip = (w: string) => w.toLowerCase().replace(/^(le |la |les |l'|l’|se |s')/, "").trim();
// Tema 4 · Words & Meanings
const C: Record<string, string[]> = {
  s1: ["la carte","l'ardoise","le sucre","la gare","le jus","la serviette","drôle","faux","vouloir dire","pas grave","c'est ça","surpris","rire","expliquer","venir","apporter","amer","noir","chaud","d'où"],
  s2: ["le plan","le quai","la montre","le vélo","le bateau","l'arrêt","long","lent","à pied","habiter","vite","tard","tôt","marcher","arriver","ça dépend","dix","presque","tous les deux","en face"],
  s3: ["le cahier","le crayon","la nappe","la lune","la gomme","l'étoile","manquer","écrire","lire","effacer","le sens","à l'envers","pour toujours","penser","compris","déjà","vrai","dur","doux","enfin"],
};
(async () => {
  const other: any[] = await p.journeyStory.findMany({ where: { journey: { language: "french" } }, select: { vocab: true, journeyId: true, journey: { select: { status: true, typeSlug: true } } } as any });
  const taught = new Map<string, string>();
  for (const s of other) for (const v of (s.vocab ?? []) as any[])
    taught.set(strip(String(v.word ?? "")), `${s.journey.typeSlug}/${s.journey.status}/${v.type}${s.journeyId === ESTE ? "/ESTE" : ""}`);
  const seen = new Map<string, string>();
  for (const [k, ws] of Object.entries(C)) for (const w of ws) {
    const l = strip(w);
    const dup = seen.get(l); seen.set(l, k);
    console.log(k, w.padEnd(16), FRENCH_A1_A2_LEMMAS.has(l) ? "lista" : "FUERA", taught.get(l) ? `YA: ${taught.get(l)}` : "", dup ? `REPETIDA en ${dup}` : "");
  }
  await p.$disconnect();
})();
