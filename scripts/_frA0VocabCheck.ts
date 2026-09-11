// Cruza candidatas de vocab del Friends FR A0 contra TODO el vocab frances
// (Expat, Traveler archivado y el propio journey, marcado /ESTE).
//   npx tsx scripts/_frA0VocabCheck.ts
import "dotenv/config";
import { PrismaClient } from "@/generated/prisma";
import { FRENCH_A1_A2_LEMMAS } from "@/lib/cefr/frenchA1A2";
const p = new PrismaClient();
const ESTE = "cmtwo6cys0007j8yzg6ni3fsc";
const strip = (w: string) => w.toLowerCase().replace(/^(le |la |les |l'|l’|se |s')/, "").trim();
// Tema 3 · Helping & Favours
const C: Record<string, string[]> = {
  s1: ["le fauteuil","la camionnette","la corde","la rampe","le coussin","le tapis","aider","porter","étroit","large","gratuit","le service","de rien","merci beaucoup","attention","le dos","avoir mal","tous les jours","lourd","ensemble"],
  s2: ["la caution","le tiroir","la tirelire","le loyer","les économies","le percolateur","prêter","emprunter","avoir besoin","l'argent","cassé","neuf","combien","mille","bientôt","le mois","compter","rendre","donner","garder"],
  s3: ["le robinet","le seau","le tuyau","la goutte","la boîte à outils","l'éponge","réparer","couler","sale","propre","voilà","ça y est","bravo","tourner","serrer","fini","dessous","avoir raison","maintenant","tout seul"],
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
