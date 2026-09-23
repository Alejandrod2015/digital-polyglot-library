/** El gate de distractores sobre un set cualquiera del catalogo, leyendo el
 *  modulo de la rama donde nacio (28d37305) sin fundirlo aqui. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import * as fs from "fs";
import { PrismaClient } from "../../src/generated/prisma";
import { distractorIssues } from "/private/tmp/claude-501/-Users-alejandrodelcarpio-digital-polyglot-library--claude-worktrees-zealous-varahamihira-246db5/76bc0772-cb52-4f72-8f0f-f65dbc9b4b44/scratchpad/distractorGate";
const p = new PrismaClient();
(async () => {
  const slug = process.argv[2];
  const s = await p.journeyStory.findFirst({ where: { slug }, select: { journeyId:true, journey: { select: { language:true } } } });
  const hermanas = await p.journeyStory.findMany({ where: { journeyId: s!.journeyId }, select: { title:true, text:true } });
  const corpus = hermanas.map(h => `${h.title}\n${h.text}`).join("\n");
  const exs = JSON.parse(fs.readFileSync(`scripts/_sets/${slug}.json`, "utf8")) as any[];
  let fallos = 0, avisos = 0;
  for (const ex of exs) {
    const r = distractorIssues(ex, { language: s!.journey!.language, corpus });
    for (const i of r.issues) { fallos++; console.log(`  ✗ ${ex.word}: ${i}`); }
    for (const w of r.warnings) { avisos++; console.log(`  W ${ex.word}: ${w}`); }
  }
  console.log(`${slug}: ${exs.length} ejercicios · ${fallos} fallos · ${avisos} avisos`);
  await p.$disconnect();
})();
