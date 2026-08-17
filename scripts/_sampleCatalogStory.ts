import dotenv from "dotenv";
dotenv.config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";

const p = new PrismaClient();

async function main() {
  const slugs = process.argv.slice(2);
  for (const slug of slugs) {
    const s = await p.catalogStory.findFirst({ where: { slug } });
    if (!s) {
      console.log(`-- ${slug}: NOT FOUND`);
      continue;
    }
    console.log(`\n===== ${s.bookId} / ${s.slug} =====`);
    console.log("title:", s.title);
    console.log("synopsis:", s.synopsis);
    console.log("audioUrl:", s.audioUrl);
    console.log("lang/var/level/cefr:", s.language, s.variant, s.level, s.cefrLevel);
    console.log("--- text (first 900 chars) ---");
    console.log((s.text ?? "").slice(0, 900));
    console.log("--- vocab ---");
    console.log(JSON.stringify(s.vocab, null, 1).slice(0, 3000));
  }
  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
