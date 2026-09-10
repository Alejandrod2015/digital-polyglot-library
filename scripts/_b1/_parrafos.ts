// Scratch: reagrupa SOLO saltos de parrafo en historias del Traveler ES B1 y escribe un
// JSON listo para saveStory.ts. Comprueba que el texto sin saltos es identico.
// Uso: _parrafos.ts <out.json>   (solo lee la base)
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import * as fs from "fs";
import { PrismaClient } from "../../src/generated/prisma";

const J = "cmt5x67ze000l320cpgunu5vi";
// merge k: junta el parrafo k (1-based, original) con el siguiente.
// split k "marcador": parte el parrafo k justo antes del marcador.
type Op = { merge: number } | { split: number; antes: string };
const OPS: Record<string, Op[]> = {
  "la-cerradura-la-cambio-yo": [{ merge: 3 }],
  "el-techo-de-los-tres": [{ split: 5, antes: "“Entonces firmo hoy”" }],
  "el-descansillo-aconseja": [{ split: 3, antes: "Ya le había contado" }],
  "la-reunion-de-un-punto": [{ split: 5, antes: "Desde luego la reunión" }],
  "a-ver-si-te-sigo": [{ merge: 2 }],
  "lo-de-chispa": [{ merge: 5 }],
  "lo-pongo-por-escrito": [{ merge: 2 }],
  "palabra-por-palabra": [{ merge: 2 }],
};
const plano = (t: string) => t.replace(/\s+/g, " ").trim();

(async () => {
  const p = new PrismaClient();
  const ss = await p.journeyStory.findMany({
    where: { journeyId: J, slug: { in: Object.keys(OPS) } },
    select: { topic: true, slotIndex: true, title: true, slug: true, synopsis: true, text: true, vocab: true, arcType: true },
  });
  await p.$disconnect();
  const out = [];
  for (const s of ss) {
    let ps = (s.text ?? "").split("\n\n");
    const antes = ps.length;
    // merges de mayor a menor para no mover los indices; splits primero no hace falta:
    // ninguna historia mezcla los dos.
    for (const op of OPS[s.slug!]) {
      if ("merge" in op) {
        const k = op.merge - 1;
        ps.splice(k, 2, `${ps[k]} ${ps[k + 1]}`);
      } else {
        const k = op.split - 1;
        const i = ps[k].indexOf(op.antes);
        if (i <= 0) throw new Error(`${s.slug}: no encuentro "${op.antes}" dentro del parrafo ${op.split}`);
        ps.splice(k, 1, ps[k].slice(0, i).trimEnd(), ps[k].slice(i));
      }
    }
    const text = ps.join("\n\n");
    if (plano(text) !== plano(s.text ?? "")) throw new Error(`${s.slug}: EL TEXTO CAMBIO`);
    const citaSola = ps.filter((x) => /“/.test(x) && !x.replace(/“[^”]*”/g, "").match(/\p{L}{2,}/u));
    console.log(`${s.topic} #${s.slotIndex} ${s.slug}: ${antes} -> ${ps.length} parrafos · texto sin saltos identico${citaSola.length ? ` · CITA SIN NARRADOR: ${citaSola.length}` : ""}`);
    out.push({ ...s, text });
  }
  out.sort((a, b) => a.slug!.localeCompare(b.slug!));
  fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
})();
