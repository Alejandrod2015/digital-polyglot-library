import dotenv from "dotenv";
dotenv.config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

function vocabCount(v: unknown): number {
  return Array.isArray(v) ? v.length : 0;
}

async function main() {
  const books = await prisma.catalogBook.findMany({
    orderBy: [{ published: "desc" }, { language: "asc" }, { slug: "asc" }],
    include: { stories: { orderBy: { position: "asc" } } },
  });

  console.log("=== CATALOG BOOKS ===");
  for (const b of books) {
    const st = b.stories;
    const withAudio = st.filter((s) => (s.audioUrl ?? s.audio ?? "").trim().length > 0).length;
    const r2 = st.filter((s) => (s.audioUrl ?? "").includes("r2")||(s.audioUrl ?? "").length > 0).length;
    const sanityAudio = st.filter((s) => !s.audioUrl && (s.audio ?? "").includes("sanity")).length;
    const withVocab = st.filter((s) => vocabCount(s.vocab) > 0).length;
    const vocabs = st.map((s) => vocabCount(s.vocab));
    const words = st.map((s) => (s.text ?? "").trim().split(/\s+/).filter(Boolean).length);
    const withCover = st.filter((s) => (s.coverUrl ?? s.cover ?? "").trim().length > 0).length;
    const emptyText = st.filter((s) => (s.text ?? "").trim().length < 50).length;
    console.log(
      [
        b.published ? "PUB " : "UNPUB",
        b.slug,
        `| ${b.language}/${b.variant ?? "-"}/${b.region ?? "-"}`,
        `| lvl=${b.level}/${b.cefrLevel ?? "-"}`,
        `| stories=${st.length}`,
        `audio=${withAudio}(r2=${r2},sanity=${sanityAudio})`,
        `vocab>0=${withVocab}`,
        `vocab[min/med/max]=${Math.min(...vocabs, 0)}/${vocabs.length ? vocabs.slice().sort((a, c) => a - c)[Math.floor(vocabs.length / 2)] : 0}/${Math.max(...vocabs, 0)}`,
        `words[min/max]=${Math.min(...words, 0)}/${Math.max(...words, 0)}`,
        `covers=${withCover}`,
        emptyText ? `EMPTYTEXT=${emptyText}` : "",
      ].join(" ")
    );
    console.log(`     title: ${b.title}${b.subtitle ? "; " + b.subtitle : ""}`);
    console.log(`     id=${b.id} storeUrl=${b.storeUrl ?? "-"} audioFolder=${b.audioFolder || "-"}`);
  }

  console.log("\n=== PER-STORY (published books only) ===");
  for (const b of books.filter((x) => x.published)) {
    console.log(`\n## ${b.slug} (${b.language}/${b.variant ?? "-"}); ${b.stories.length} stories`);
    for (const s of b.stories) {
      const audio = s.audioUrl ?? s.audio ?? "";
      const words = (s.text ?? "").trim().split(/\s+/).filter(Boolean).length;
      const vc = vocabCount(s.vocab);
      // count data-word tags in text
      const tagged = new Set(
        [...(s.text ?? "").matchAll(/data-word="([^"]+)"/g)].map((m) => m[1].toLowerCase())
      );
      const vocabWords = new Set(
        (Array.isArray(s.vocab) ? (s.vocab as any[]) : []).map((v) => String(v?.word ?? "").toLowerCase())
      );
      const taggedNotInVocab = [...tagged].filter((w) => !vocabWords.has(w));
      const vocabNotTagged = [...vocabWords].filter((w) => !tagged.has(w));
      console.log(
        `  ${String(s.position).padStart(2)} ${s.slug.padEnd(42)} w=${String(words).padStart(4)} vocab=${String(vc).padStart(2)} tagged=${String(tagged.size).padStart(2)}` +
          ` audio=${audio ? (audio.includes("sanity") ? "SANITY" : "R2") : "NONE"}` +
          ` syn=${s.synopsis ? "y" : "n"}` +
          ` cover=${s.coverUrl ?? s.cover ? "y" : "n"}` +
          (taggedNotInVocab.length ? ` !taggedNoDef=${taggedNotInVocab.length}` : "") +
          (vocabNotTagged.length ? ` !vocabNoTag=${vocabNotTagged.length}` : "")
      );
    }
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
