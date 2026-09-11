// Cruza candidatas de vocab del Friends FR A0 contra TODO el vocab frances
// (Expat, Traveler archivado y el propio journey, marcado /ESTE).
//   npx tsx scripts/_frA0VocabCheck.ts
import "dotenv/config";
import { PrismaClient } from "@/generated/prisma";
import { FRENCH_A1_A2_LEMMAS } from "@/lib/cefr/frenchA1A2";
const p = new PrismaClient();
const ESTE = "cmtwo6cys0007j8yzg6ni3fsc";
const strip = (w: string) => w.toLowerCase().replace(/^(le |la |les |l'|l’|se |s')/, "").trim();
// Tema 6 · Houses & Neighbours
const C: Record<string, string[]> = {
  s1: ["le volet","la boîte aux lettres","le couloir","l'annonce","la cave","la poignée","louer","déménager","vendre","le locataire","méchant","libre","désolé","cent","d'habitude","en haut","à louer","pas encore","demain","tout de suite"],
  s2: ["la plante","l'arrosoir","les meubles","l'ampoule","le chauffage","le plafond","arroser","vider","peindre","grandir","blanc","vert","sec","vivant","tiède","la feuille","la terre","s'il te plaît","petit à petit","tous les matins"],
  s3: ["les pas","le parquet","l'écharpe","le manteau","le chien","la laisse","monter","saluer","regarder","quelqu'un","inconnu","brun","gros","sympa","au-dessus","tout à coup","ensuite","ailleurs","chez moi","trop"],
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
