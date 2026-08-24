import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { variantPool } from "@/lib/languageVariant";
import { isSpanishA1A2 } from "@/lib/cefr/spanishA1A2";
const CAND: Record<string, string[]> = {
  "verbos": ["esperar","llamar","mandar","llevar","traer","pedir","dar","decir","ver","oir","saber","querer","deber","poder","hacer","ir","venir","estar","tener","andar","correr","saltar","tirar","empezar","terminar","seguir","parar","cortar","pegar","atar","colgar","apagar","prender","llenar","secar","mojar","doblar","estirar","apretar","aflojar"],
  "adjetivos": ["largo","corto","alto","bajo","ancho","estrecho","grueso","delgado","nuevo","limpio","oscuro","claro","fuerte","suave","dulce","amargo","tibio","helado","lleno","abierto","cerrado","listo","tranquilo","nervioso","cansado","contento","serio","amable","joven","fácil"],
};
const p = new PrismaClient();
(async () => {
  const mio = await p.journey.findUnique({ where: { id: "cmt5vxwgd0007324oesy195k8" }, select: { variant: true, typeSlug: true } });
  const otras = await p.journeyStory.findMany({
    where: { journey: { language: "spanish", status: { not: "archived" } }, journeyId: { not: "cmt5vxwgd0007324oesy195k8" } },
    select: { vocab: true, journey: { select: { typeSlug: true, variant: true } } } });
  const duro = new Set<string>(), blando = new Set<string>();
  for (const r of otras) {
    if (variantPool(mio!.variant) !== variantPool(r.journey?.variant)) continue;
    const d = r.journey?.typeSlug === mio!.typeSlug ? duro : blando;
    for (const v of ((r.vocab as any[]) ?? [])) if (v?.word) d.add(String(v.word));
  }
  for (const [tema, ws] of Object.entries(CAND)) {
    const ok: string[] = [], choca: string[] = [], fuera: string[] = [];
    for (const w of ws) {
      if (duro.has(w)) choca.push(w);
      else if (!isSpanishA1A2(w)) fuera.push(w);
      else ok.push(w);
    }
    console.log(`\n${tema}`);
    console.log(`  libres y en nivel (${ok.length}): ${ok.join(", ")}`);
    if (choca.length) console.log(`  CHOCAN con otro Traveler (${choca.length}): ${choca.join(", ")}`);
    if (fuera.length) console.log(`  fuera de la lista A1/A2 (${fuera.length}): ${fuera.join(", ")}`);
  }
  await p.$disconnect();
})();
