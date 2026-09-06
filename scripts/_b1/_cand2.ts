import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
import { isSpanishUpToLevel } from "../../src/lib/cefr/spanishLevels";
const p = new PrismaClient();
const VERB = `mudarse alisar parpadear colgar estirar aceptar apuntar firmar levantar callar
alquilar avisar rematar constar reunir revisar comprobar anotar acercar arrastrar soltar
encender apagar cerrar abrir tardar mover probar aguantar quedar`.split(/\s+/).filter(Boolean);
const EXPR = `adelantado momento golpe sobra marcha falta acaso paso serio cuenta vez mano tiempo`.split(/\s+/).filter(Boolean);
(async () => {
  const js = await p.journey.findMany({ where: { language: { equals: "spanish", mode: "insensitive" }, variant: "spain", status: { not: "archived" } }, select: { id: true } });
  const rows = await p.journeyStory.findMany({ where: { journeyId: { in: js.map((x) => x.id) } }, select: { journeyId: true, vocab: true } });
  const ajeno = new Set<string>();
  for (const r of rows) if (r.journeyId !== "cmt5x67ze000l320cpgunu5vi")
    for (const v of ((r.vocab as Array<{ word: string }>) ?? [])) ajeno.add(v.word.toLowerCase().trim());
  for (const [nom, L] of [["VERBOS", VERB], ["NUCLEOS DE EXPRESION", EXPR]] as const) {
    const ok = L.filter((w) => !ajeno.has(w) && isSpanishUpToLevel(w, "b1"));
    console.log(`${nom} libres (${ok.length}): ${ok.join(", ")}`);
  }
  await p.$disconnect();
})();
