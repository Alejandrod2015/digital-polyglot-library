import dotenv from "dotenv";
dotenv.config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";

const p = new PrismaClient();

function esc(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function inText(w: string, t: string) {
  try {
    return new RegExp(`(^|[^\\p{L}\\p{N}_])${esc(w)}($|[^\\p{L}\\p{N}_])`, "iu").test(t);
  } catch {
    return false;
  }
}

async function main() {
  const books = await p.catalogBook.findMany({
    where: { published: true },
    orderBy: { slug: "asc" },
    include: { stories: { orderBy: { position: "asc" } } },
  });
  const timings = new Set((await p.catalogStoryAudioTimings.findMany({ select: { slug: true } })).map((t) => t.slug));

  const rows: string[] = [];
  rows.push(
    "book | lang | n | avgWords | avgVocab | vocab/100w | orphans | noType | noSynopsis | noTimings"
  );
  let T = { n: 0, v: 0, orph: 0, nt: 0, ns: 0, tm: 0 };
  for (const b of books) {
    const st = b.stories;
    const plains = st.map((s) => (s.text ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
    const words = plains.map((t) => t.split(/\s+/).filter(Boolean).length);
    const vocabs = st.map((s) => (Array.isArray(s.vocab) ? (s.vocab as any[]) : []));
    const orph = st.reduce((acc, s, i) => acc + vocabs[i].filter((v) => !inText(String(v?.surface || v?.word || ""), plains[i])).length, 0);
    const noType = st.reduce((acc, _s, i) => acc + vocabs[i].filter((v) => !String(v?.type ?? "").trim()).length, 0);
    const noSyn = st.filter((s) => !s.synopsis).length;
    const noTm = st.filter((s) => !timings.has(s.slug)).length;
    const totW = words.reduce((a, c) => a + c, 0);
    const totV = vocabs.reduce((a, c) => a + c.length, 0);
    T.n += st.length; T.v += totV; T.orph += orph; T.nt += noType; T.ns += noSyn; T.tm += noTm;
    rows.push(
      [
        b.slug,
        `${b.language}/${b.region ?? "-"}`,
        st.length,
        Math.round(totW / st.length),
        (totV / st.length).toFixed(1),
        ((totV / totW) * 100).toFixed(1),
        orph,
        noType,
        noSyn,
        noTm,
      ].join(" | ")
    );
  }
  console.log(rows.join("\n"));
  console.log("\nTOTAL published:", T);
  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
