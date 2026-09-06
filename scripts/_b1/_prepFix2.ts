import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import * as fs from "node:fs";
import { PrismaClient } from "../../src/generated/prisma";

/** Dos arreglos que solo se ven leyendo el A2 y el B1 seguidos:
 *  1. "el bajo" nombraba a DOS personas: la panaderia de Rosa y el propietario
 *     que nadie ve desde agosto, en la misma historia. El ausente pasa al atico,
 *     que ademas es lo que es: un piso de veraneo cerrado.
 *  2. La sinopsis de la primera prometia un descubrimiento que el A2 ya dio:
 *     Irene ya vio vaciarse el pueblo en octubre y ya decidio quedarse. */
const TEXTO: Record<string, [string, string][]> = {
  "cada-uno-dice-lo-suyo": [["El del bajo aparece", "El del ático aparece"]],
  "el-plastico-no-arregla-nada": [["“Al del bajo no lo ve nadie desde agosto”", "“Al del ático no lo ve nadie desde agosto”"]],
};
const SINOPSIS: Record<string, string> = {
  "ya-no-queda-nadie":
    "Irene estrena con las llaves recién dadas su primer invierno de propietaria, que no se parece nada al otoño en que decidió quedarse. Rocío sube a decirle que el frío no entra por donde ella cree, y ninguna de las dos nombra lo de octubre. Esa noche, debajo de la lámpara, aparece en el techo una mancha blanda que en verano no estaba, y al día siguiente aprende que ni siquiera es suya del todo.",
};

(async () => {
  const p = new PrismaClient();
  const slugs = [...new Set([...Object.keys(TEXTO), ...Object.keys(SINOPSIS)])];
  const ss = await p.journeyStory.findMany({
    where: { journeyId: "cmt5x67ze000l320cpgunu5vi", slug: { in: slugs } },
    select: { topic: true, slotIndex: true, title: true, slug: true, arcType: true, synopsis: true, text: true, vocab: true },
  });
  await p.$disconnect();
  const out = ss.map((s) => {
    let text = s.text;
    for (const [de, a] of TEXTO[s.slug!] ?? []) {
      if (!text.includes(de)) throw new Error(`no encuentro "${de}" en ${s.slug}`);
      text = text.replace(de, a);
    }
    console.log(`${s.slug} -> ${text.trim().split(/\s+/).length} palabras${SINOPSIS[s.slug!] ? " (+sinopsis)" : ""}`);
    return { topic: s.topic, slotIndex: s.slotIndex, title: s.title, slug: s.slug, arcType: s.arcType,
             synopsis: SINOPSIS[s.slug!] ?? s.synopsis, text, vocab: s.vocab };
  });
  fs.writeFileSync("scripts/_b1/fix/dos.json", JSON.stringify(out, null, 1) + "\n");
})();
