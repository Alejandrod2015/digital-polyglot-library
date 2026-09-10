// Scratch: mide los 7 temas del Traveler ES B1 antes/despues de las ediciones de banda,
// comprueba los cierres contra el registro y lista el vocab de las frases tocadas.
// Solo lee: no escribe en la base.
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import * as fs from "fs";
import { PrismaClient } from "../../src/generated/prisma";
import { mide } from "./sonda/_gramProbe";
import { hashTema, leerRegistro, claveCierre } from "../temaCierres";

const J = "cmt5x67ze000l320cpgunu5vi";
const BANDA: Record<string, [number, number]> = {
  "subj. imperfecto": [1, 4], "condicional": [1, 5], "estilo indirecto": [1, 3],
};
const ed: Array<{ topic: string; slug: string; old: string; new: string }> =
  JSON.parse(fs.readFileSync(process.argv[2], "utf8"));

(async () => {
  const p = new PrismaClient();
  const j = await p.journey.findUnique({ where: { id: J }, select: { topics: true } });
  const reg = leerRegistro();
  for (const t of j!.topics) {
    const ss = await p.journeyStory.findMany({
      where: { journeyId: J, topic: t }, orderBy: { slotIndex: "asc" },
      select: { slug: true, title: true, text: true, vocab: true, slotIndex: true },
    });
    const c = reg[claveCierre(J, t)] as { hash?: string } | undefined;
    const h = hashTema(ss as never);
    const antes = mide(ss.map((s) => s.text ?? "").join("\n\n"));
    const nuevos = ss.map((s) => {
      let tx = s.text ?? "";
      for (const e of ed.filter((e) => e.slug === s.slug)) {
        if (!tx.includes(e.old)) throw new Error(`no encuentro en ${s.slug}: ${e.old}`);
        tx = tx.replace(e.old, e.new);
        const vw = (s.vocab as Array<{ word: string }>).map((v) => v.word)
          .filter((w) => new RegExp(`\\b${w}\\b`, "iu").test(e.old));
        console.log(`   vocab en la frase de ${s.slug}: ${vw.join(", ") || "-"}; sigue: ${vw.map((w) => new RegExp(`\\b${w}\\b`, "iu").test(e.new) ? "si" : "NO").join(",")}`);
      }
      return tx;
    });
    const despues = mide(nuevos.join("\n\n"));
    const fila = Object.keys(BANDA).map((n) => {
      const [lo, hi] = BANDA[n];
      const a = antes.usos[n], d = despues.usos[n];
      return `${n.replace("subj. imperfecto", "subj.impf").replace("estilo indirecto", "est.ind").replace("condicional", "cond")} ${a}->${d}${d < lo || d > hi ? " FUERA" : ""}`;
    }).join(" · ");
    console.log(`${t} (${despues.oraciones ?? "?"} or.) cierre ${c?.hash === h ? "VIGENTE" : "CADUCO"} ${h} · ${fila}`);
  }
  await p.$disconnect();
})();
