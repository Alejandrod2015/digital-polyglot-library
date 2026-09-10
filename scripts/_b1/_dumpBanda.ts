// Scratch: vuelca las historias tocadas por las ediciones de banda B1, con el texto ya
// editado, en un JSON por tema listo para saveStory.ts. Solo lee la base.
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import * as fs from "fs";
import { PrismaClient } from "../../src/generated/prisma";

const J = "cmt5x67ze000l320cpgunu5vi";
const [edFile, outDir] = process.argv.slice(2);
const ed: Array<{ topic: string; slug: string; old: string; new: string }> =
  JSON.parse(fs.readFileSync(edFile, "utf8"));

(async () => {
  const p = new PrismaClient();
  const j = await p.journey.findUnique({ where: { id: J }, select: { topics: true } });
  for (const [i, t] of j!.topics.entries()) {
    const slugs = [...new Set(ed.filter((e) => e.topic === t).map((e) => e.slug))];
    if (!slugs.length) continue;
    const ss = await p.journeyStory.findMany({
      where: { journeyId: J, topic: t, slug: { in: slugs } }, orderBy: { slotIndex: "asc" },
      select: { topic: true, slotIndex: true, title: true, slug: true, synopsis: true, text: true, vocab: true, arcType: true },
    });
    const out = ss.map((s) => {
      let text = s.text ?? "";
      for (const e of ed.filter((e) => e.slug === s.slug)) {
        if (!text.includes(e.old)) throw new Error(`no encuentro en ${s.slug}: ${e.old}`);
        text = text.replace(e.old, e.new);
      }
      return { ...s, text };
    });
    const f = `${outDir}/banda-t${i + 1}.json`;
    fs.writeFileSync(f, JSON.stringify(out, null, 1));
    console.log(f, out.map((s) => s.slug).join(", "));
  }
  await p.$disconnect();
})();
