import "dotenv/config";
import { PrismaClient } from "@/generated/prisma";
import { FRENCH_A1_A2_LEMMAS } from "@/lib/cefr/frenchA1A2";
const p = new PrismaClient();
const strip = (w: string) => w.toLowerCase().replace(/^(le |la |les |l'|l’|se |s')/, "").trim();
const C: Record<string, string[]> = {
  s1: ["la placette","faire semblant","à toi","quitter","le départ","rond","vraiment","rouler","lancer","mars","triste","loin","près","perdre"],
  s2: ["le tablier","le carreau","l'ombre","viser","souffler","fâché","pareil","bête","encore une fois","le poignet","devoir","montrer","facile","droit"],
  s3: ["la craie","le lampadaire","le gravier","la ficelle","le sac","le chiffon","espérer","pour de vrai","une à une","le perdant","fier","tant pis","se taire","sûr","jamais","vouloir","parier","ramasser","promettre","oublier"],
};
(async () => {
  const other: any[] = await p.journeyStory.findMany({ where: { journey: { language: "french" }, journeyId: { not: "cmtwo6cys0007j8yzg6ni3fsc" } }, select: { vocab: true, journey: { select: { status: true, typeSlug: true } } } as any });
  const taught = new Map<string, string>();
  for (const s of other) for (const v of (s.vocab ?? []) as any[]) taught.set(strip(String(v.word ?? "")), `${s.journey.typeSlug}/${s.journey.status}/${v.type}`);
  for (const [k, ws] of Object.entries(C)) for (const w of ws) {
    const l = strip(w);
    console.log(k, w.padEnd(16), FRENCH_A1_A2_LEMMAS.has(l) ? "lista" : "FUERA", taught.get(l) ? `YA: ${taught.get(l)}` : "");
  }
  await p.$disconnect();
})();
