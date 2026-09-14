// Cruza candidatas de vocab del Friends FR A0 contra TODO el vocab frances
// (Expat, Traveler archivado y el propio journey, marcado /ESTE).
//   npx tsx scripts/_frA0VocabCheck.ts
import "dotenv/config";
import { PrismaClient } from "@/generated/prisma";
import { FRENCH_A1_A2_LEMMAS } from "@/lib/cefr/frenchA1A2";
const p = new PrismaClient();
const ESTE = "cmtwo6cys0007j8yzg6ni3fsc";
const strip = (w: string) => w.toLowerCase().replace(/^(le |la |les |l'|l’|se |s')/, "").trim();
// Tema 7 · Travel & Goodbyes
const C: Record<string, string[]> = {
  s1: ["la voiture","le coffre","le réveil","le mouchoir","le port","le klaxon","savoir","pouvoir","parler","mettre","sortir","retenir","pleurer","premier","prêt","lentement","la larme","au revoir","à samedi","bon voyage"],
  s2: ["la poussière","la casquette","les lunettes","la gourde","le printemps","le coude","servir","trouver","boire","apprendre","tenir","descendre","essayer","plier","baisser","difficile","toujours","l'élève","chaque dimanche","avec plaisir"],
  s3: ["le TGV","le canapé","l'oreiller","la bise","la baguette","le pain au chocolat","rêver","tricher","manger","lever","possible","jaune","treize","l'égalité","la joue","le petit-déjeuner","la prochaine fois","comme avant","à la maison","encore un peu"],
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
