/** Palabras del cuerpo de cada candidato que estan LIBRES como vocab. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import * as fs from "fs";
const J = "cmtgelq560007j84n3ujx9bpd";
const p = new PrismaClient();
const PORT = new Set(["verb","adjective","adverb","expression"]);
const STOP = new Set("el la los las un una unos unas de del a al y o que en con por para se le les lo su sus mi mis tu tus es son era eran esta este esto estos estas ese esa eso no si ya me te nos como cuando donde muy mas más ni pero porque sin sobre entre hasta desde tan tanto todo toda todos todas hay ha han he has hemos habia había fue fui ser estar hacer dice dijo dijeron le les yo el ella usted ustedes aqui aquí ahi ahí alli allí".split(/\s+/));

(async () => {
  const cand = JSON.parse(fs.readFileSync(process.argv[2], "utf8")) as any[];
  const enTanda = new Set(cand.map((s) => `${s.topic}#${s.slotIndex}`));
  const mio = await p.journey.findUnique({ where: { id: J }, select: { language: true, typeSlug: true } });
  const duro = new Set<string>(); const blando = new Set<string>();
  const otras = await p.journeyStory.findMany({ where: { journey: { language: mio!.language, status: { not: "archived" } }, journeyId: { not: J } }, select: { vocab: true, journey: { select: { typeSlug: true, levels: true } } } });
  for (const r of otras) for (const v of ((r.vocab as any[]) ?? [])) {
    if (!v?.word || PORT.has(String(v.type ?? "").toLowerCase())) continue;
    const mismoTipo = r.journey?.typeSlug === mio!.typeSlug;
    const mismoNivel = (r.journey?.levels ?? []).some((l: any) => String(l).toLowerCase() === "a2");
    if (mismoTipo && !mismoNivel) continue;
    (mismoTipo ? duro : blando).add(String(v.word));
  }
  const propias = await p.journeyStory.findMany({ where: { journeyId: J }, select: { topic: true, slotIndex: true, vocab: true } });
  for (const r of propias) { if (enTanda.has(`${r.topic}#${r.slotIndex}`)) continue; for (const v of ((r.vocab as any[]) ?? [])) if (v?.word) duro.add(String(v.word)); }

  for (const s of cand) {
    const ws = [...new Set(String(s.text).toLowerCase().replace(/[“”".,¿?¡!:;()]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w) && !/^\d/.test(w)))];
    const libres = ws.filter((w) => !duro.has(w) && !blando.has(w));
    console.log(`\n### ${s.slotIndex} ${s.title}`);
    console.log("LIBRES: " + libres.join(" "));
  }
  await p.$disconnect();
})();
