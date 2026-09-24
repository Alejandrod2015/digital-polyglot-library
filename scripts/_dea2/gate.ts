/** Corre el gate de distractores (D1-D8) sobre los sets del A2. El modulo vive
 *  en la rama donde nacio (commit 28d37305) y aqui se lee de fuera del arbol
 *  para no fusionar trabajo ajeno en esta rama. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import * as fs from "fs";
import { PrismaClient } from "../../src/generated/prisma";
import { distractorIssues } from "/private/tmp/claude-501/-Users-alejandrodelcarpio-digital-polyglot-library--claude-worktrees-zealous-varahamihira-246db5/76bc0772-cb52-4f72-8f0f-f65dbc9b4b44/scratchpad/distractorGate";
const JID = "cmubidgaf0007j8np6g7n89iu";
const p = new PrismaClient();
(async () => {
  const st = await p.journeyStory.findMany({ where: { journeyId: JID }, select: { slug: true, title: true, text: true } });
  const corpus = st.map((s) => `${s.title}\n${s.text}`).join("\n");
  const slugs = st.map((s) => s.slug!).filter((s) => fs.existsSync(`scripts/_sets/${s}.json`));
  let malos = 0, avisos = 0;
  for (const slug of slugs.sort()) {
    const exs = JSON.parse(fs.readFileSync(`scripts/_sets/${slug}.json`, "utf8"));
    const issues: string[] = [], warns: string[] = [];
    for (const ex of exs) {
      const r = distractorIssues(ex, { language: "german", corpus });
      for (const i of r.issues) issues.push(`${ex.word}: ${i}`);
      for (const w of r.warnings) warns.push(`${ex.word}: ${w}`);
    }
    malos += issues.length; avisos += warns.length;
    if (issues.length) console.log(`✗ ${slug}\n    ` + issues.join("\n    "));
    else console.log(`✓ ${slug}` + (warns.length ? `  (${warns.length} aviso)` : ""));
    for (const w of warns) console.log(`    W ${w}`);
  }
  console.log(`\n${slugs.length} sets, ${malos} fallos, ${avisos} avisos`);
  await p.$disconnect();
  process.exit(malos ? 1 : 0);
})();
