import dotenv from "dotenv";
dotenv.config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";

const p = new PrismaClient();

async function main() {
  const book = process.argv[2];
  const from = Number(process.argv[3] ?? 0);
  const to = Number(process.argv[4] ?? from + 3);
  const stories = await p.catalogStory.findMany({
    where: { book: { slug: book } },
    orderBy: { position: "asc" },
  });
  for (const s of stories.filter((x) => x.position >= from && x.position <= to)) {
    const plain = (s.text ?? "").replace(/<[^>]+>/g, "").replace(/\n{2,}/g, "\n").trim();
    const v = (Array.isArray(s.vocab) ? s.vocab : []) as { word: string; definition: string }[];
    console.log(`\n##### [${s.position}] ${s.slug}  (${plain.split(/\s+/).length} palabras, vocab actual ${v.length})`);
    console.log(`VOCAB: ${v.map((x) => x.word).join(" | ")}`);
    console.log(`TEXTO: ${plain}`);
  }
  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
