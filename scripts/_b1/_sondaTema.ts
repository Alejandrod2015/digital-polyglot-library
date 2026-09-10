// Scratch: mide un tema con los textos nuevos de un JSON de guardado encima de la base y
// sale con 1 si un marcador queda fuera de la banda B1. Uso: _sondaTema.ts <topic> <banda.json>
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import * as fs from "fs";
import { PrismaClient } from "../../src/generated/prisma";
import { mide } from "./sonda/_gramProbe";

const BANDA: Record<string, [number, number]> = {
  "subj. imperfecto": [1, 4], "condicional": [1, 5], "estilo indirecto": [1, 3],
};
(async () => {
  const [topic, f] = process.argv.slice(2);
  const nuevo = JSON.parse(fs.readFileSync(f, "utf8")) as Array<{ slug: string; text: string }>;
  const p = new PrismaClient();
  const ss = await p.journeyStory.findMany({
    where: { journeyId: "cmt5x67ze000l320cpgunu5vi", topic }, orderBy: { slotIndex: "asc" },
    select: { slug: true, text: true },
  });
  await p.$disconnect();
  const r = mide(ss.map((s) => nuevo.find((n) => n.slug === s.slug)?.text ?? s.text ?? "").join("\n\n"));
  let mal = false;
  const fila = Object.entries(BANDA).map(([n, [lo, hi]]) => {
    const v = r.usos[n];
    if (v < lo || v > hi) mal = true;
    return `${n} ${v}${v < lo || v > hi ? " FUERA" : ""} ${JSON.stringify(r.tokens[n])}`;
  });
  console.log(`${topic} (${r.oraciones} or.) ${fila.join(" · ")}`);
  process.exit(mal ? 1 : 0);
})();
