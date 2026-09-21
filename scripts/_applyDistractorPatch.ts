/**
 * Aplica un parche de distractores a ejercicios que YA estan en la base, sin
 * resembrar: solo cambia `payload.options` (y `optionTranslations` en
 * fill_blank / listen_choose). La respuesta, la oracion y los clips no se
 * tocan, asi que no hay audio que regenerar.
 *
 * Parche: JSON `{ [exerciseId]: { options: string[], optionTranslations?: string[] } }`.
 * La respuesta va la PRIMERA en `options` (convencion de los JSON curados; la
 * API baraja al servir). En meaning_in_context la glosa de la respuesta se
 * puede reescribir (options[0] pasa a ser `answer`); en fill_blank y listen
 * options[0] tiene que ser la palabra de siempre, que es la que suena.
 *
 * Cada ejercicio parcheado pasa por el gate (scripts/distractorGate.ts) con el
 * corpus de su journey; si sigue fallando, NO se escribe y se lista. El mismo
 * cambio se copia a scripts/_sets/<slug>.json cuando existe, casando por
 * (type, word), para que un resembrado futuro no deshaga el arreglo.
 *
 *   npx tsx scripts/_applyDistractorPatch.ts <patch.json> [--dry]
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import * as fs from "fs";
import { PrismaClient } from "../src/generated/prisma";
import { distractorIssues } from "./distractorGate";

const prisma = new PrismaClient();
const norm = (s: string) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

async function main() {
  const file = process.argv[2];
  const dry = process.argv.includes("--dry");
  if (!file) throw new Error("uso: _applyDistractorPatch.ts <patch.json> [--dry]");
  const patch: Record<string, { options: string[]; optionTranslations?: string[] }> = JSON.parse(fs.readFileSync(file, "utf8"));
  const ids = Object.keys(patch);
  const rows = await prisma.storyPracticeExercise.findMany({
    where: { id: { in: ids } },
    select: { id: true, type: true, word: true, sentence: true, payload: true,
      set: { select: { story: { select: { slug: true, journeyId: true, journey: { select: { language: true } } } } } } },
  });
  const corpusByJourney = new Map<string, string>();
  for (const jid of new Set(rows.map((r) => r.set.story.journeyId))) {
    const bodies = await prisma.journeyStory.findMany({ where: { journeyId: jid }, select: { text: true } });
    corpusByJourney.set(jid, bodies.map((b) => b.text ?? "").join("\n"));
  }
  let ok = 0; const bad: string[] = []; const jsonTouched = new Set<string>();
  for (const id of ids) {
    const r = rows.find((x) => x.id === id);
    if (!r) { bad.push(`${id}: no existe en la base`); continue; }
    const pl: any = r.payload ?? {};
    const p = patch[id];
    const opts = p.options.map((o) => String(o).trim());
    if (opts.length !== 4 || new Set(opts).size !== 4) { bad.push(`${id} '${r.word}': options no son 4 distintas`); continue; }
    // En meaning la respuesta es una glosa y se puede reescribir (no tiene
    // audio); en fill_blank y listen es la palabra que suena y no se toca.
    if (r.type !== "meaning_in_context" && opts[0] !== pl.answer) { bad.push(`${id} '${r.word}': options[0] (${opts[0]}) != answer (${pl.answer})`); continue; }
    const newPl: any = { ...pl, options: opts, answer: opts[0] };
    if (r.type !== "meaning_in_context") {
      const tr = p.optionTranslations;
      if (!tr || tr.length !== 4) { bad.push(`${id} '${r.word}': ${r.type} necesita optionTranslations (4)`); continue; }
      newPl.optionTranslations = tr.map((t) => String(t).trim());
    }
    const lang = r.set.story.journey.language;
    const g = distractorIssues({ type: r.type, word: r.word, sentence: r.sentence, payload: newPl }, { language: lang, corpus: corpusByJourney.get(r.set.story.journeyId) });
    if (g.issues.length) { bad.push(`${id} '${r.word}': sigue fallando: ${g.issues.join(" | ")}`); continue; }
    if (!dry) {
      await prisma.storyPracticeExercise.update({ where: { id }, data: { payload: newPl, distractorSource: "authored" } });
      const jp = `scripts/_sets/${r.set.story.slug}.json`;
      if (fs.existsSync(jp)) {
        const arr: any[] = JSON.parse(fs.readFileSync(jp, "utf8"));
        const e = arr.find((x) => x.type === r.type && norm(x.word) === norm(r.word));
        if (e) {
          e.payload.options = opts;
          e.payload.answer = opts[0];
          if (newPl.optionTranslations) e.payload.optionTranslations = newPl.optionTranslations;
          fs.writeFileSync(jp, JSON.stringify(arr, null, 2) + "\n");
          jsonTouched.add(jp);
        }
      }
    }
    ok++;
  }
  console.log(`${dry ? "[dry] " : ""}${ok} parcheados, ${bad.length} rechazados, ${jsonTouched.size} JSON tocados`);
  for (const b of bad) console.log("  ✗ " + b);
  if (bad.length) process.exitCode = 1;
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
