// Scratch: comprueba un recorte de historias del Traveler ES B1 contra la base.
// Por historia: solo supresiones (las palabras nuevas son subsecuencia de las viejas),
// palabras, % citado, parrafos y las 20 plazas en el cuerpo. Por tema: oraciones y banda.
// Uso: _compruebaCorte.ts <banda-t*.json> ...   (solo lee)
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import * as fs from "fs";
import { PrismaClient } from "../../src/generated/prisma";
import { mide } from "./sonda/_gramProbe";

const J = "cmt5x67ze000l320cpgunu5vi";
const BANDA: Record<string, [number, number]> = { "subj. imperfecto": [1, 4], "condicional": [1, 5], "estilo indirecto": [1, 3] };
const pal = (t: string) => (t.toLowerCase().match(/[\p{L}\d]+/gu) ?? []);
const citado = (t: string) => (t.match(/“[^”]*”/g) ?? []).reduce((a, m) => a + pal(m).length, 0);
const subsec = (a: string[], b: string[]) => { let i = 0; for (const w of a) if (i < b.length && b[i] === w) i++; return i === b.length; };

(async () => {
  const p = new PrismaClient();
  for (const f of process.argv.slice(2)) {
    const nuevas = JSON.parse(fs.readFileSync(f, "utf8")) as Array<{ slug: string; topic: string; text: string; vocab: Array<{ word: string; surface?: string }> }>;
    const topic = nuevas[0].topic;
    const todas = await p.journeyStory.findMany({ where: { journeyId: J, topic }, orderBy: { slotIndex: "asc" }, select: { slug: true, text: true } });
    for (const n of nuevas) {
      const v = todas.find((s) => s.slug === n.slug)!.text ?? "";
      const nw = pal(n.text).length, vw = pal(v).length;
      const falta = n.vocab.filter((x) => ![x.surface, x.word].filter(Boolean).some((k) => new RegExp(`(?<![\\p{L}])${k!.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}])`, "u").test(n.text.toLowerCase())));
      const q = Math.round((100 * citado(n.text)) / nw);
      const aviso = [
        subsec(pal(v), pal(n.text)) ? "" : "NO ES SOLO SUPRESION",
        nw < 140 || nw > 145 ? `PALABRAS FUERA (${nw})` : "",
        q < 25 || q > 35 ? `CITA FUERA (${q}%)` : "",
        falta.length ? `VOCAB AUSENTE: ${falta.map((x) => x.word).join(", ")}` : "",
      ].filter(Boolean).join(" · ");
      console.log(`${n.slug.padEnd(28)} ${vw} -> ${nw} pal · citado ${Math.round((100 * citado(v)) / vw)}% -> ${q}% · parrafos ${v.split("\n\n").length} -> ${n.text.split("\n\n").length}${aviso ? " · " + aviso : ""}`);
    }
    const r = mide(todas.map((s) => nuevas.find((n) => n.slug === s.slug)?.text ?? s.text ?? "").join("\n\n"));
    const fila = Object.entries(BANDA).map(([k, [lo, hi]]) => `${k} ${r.usos[k]}${r.usos[k] < lo || r.usos[k] > hi ? " FUERA" : ""}`).join(" · ");
    console.log(`   ${topic}: ${r.oraciones} oraciones · ${fila} · parrafos del tema ${todas.map((s) => (nuevas.find((n) => n.slug === s.slug)?.text ?? s.text ?? "").split("\n\n").length).join("/")}`);
  }
  await p.$disconnect();
})();
