/** Por historia: cuantas plazas caen ya en el cubo BLANDO (otros tipos de mi
 *  pool, tope 2), y la lista de palabras usables que quedan. Sirve para elegir
 *  el cambio ANTES de escribirlo, no para descubrirlo al validar. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { isSpanishA1A2 } from "@/lib/cefr/spanishA1A2";
import * as fs from "fs";
const J = "cmt5vxwgd0007324oesy195k8";
const P = new Set(["latam", "mexico", "colombia", "argentina"]);
(async () => {
  const p = new PrismaClient();
  const js = await p.journey.findMany({
    where: { language: "spanish", status: { not: "archived" }, id: { not: J } },
    select: { variant: true, typeSlug: true, stories: { select: { vocab: true } } } });
  const duro = new Set<string>(), blando = new Set<string>();
  for (const j of js) {
    if (!P.has(String(j.variant))) continue;
    const d = j.typeSlug === "traveler" ? duro : blando;
    for (const st of j.stories) for (const v of ((st.vocab as any[]) ?? [])) if (v?.word) d.add(String(v.word));
  }
  const D = JSON.parse(fs.readFileSync("scripts/_a1latamV2.json", "utf8"));
  const ORD = ["night-buses","prices-and-change","calls-and-messages","help-and-repairs",
               "names-for-things","doors-and-neighbours","plans-and-invitations"];
  D.sort((a: any, b: any) => (ORD.indexOf(a.topic) - ORD.indexOf(b.topic)) || a.slotIndex - b.slotIndex);
  D.forEach((s: any, i: number) => {
    const b = s.vocab.filter((v: any) => blando.has(v.word)).map((v: any) => v.word);
    console.log(`${String(i + 1).padStart(2)} blandas ${b.length}/2  ${s.title}${b.length ? "  <- " + b.join(", ") : ""}`);
  });
  const mias = new Set(D.flatMap((s: any) => s.vocab.map((v: any) => v.word)));
  const CAND = process.argv.slice(2);
  if (CAND.length) {
    const ok = CAND.filter(w => !duro.has(w) && !mias.has(w) && isSpanishA1A2(w));
    console.log(`\nusables de los que pasaste: ${ok.length} -> ${ok.join(", ")}`);
    console.log(`de esos, cuentan en el BLANDO: ${ok.filter(w => blando.has(w)).join(", ") || "ninguno"}`);
  }
  await p.$disconnect();
})();
