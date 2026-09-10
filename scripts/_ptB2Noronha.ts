/** SOLO LECTURA. Frases del PT B2 (journey cmtq5n9a50007j8812p9lzxjr) donde sale "noronha", y su bundle. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { extractStoryPlainText } from "../src/lib/storyPlainText";
const p = new PrismaClient();
(async () => {
  const st = await p.journeyStory.findMany({ where: { journeyId: "cmtq5n9a50007j8812p9lzxjr" }, select: { slug: true, title: true, text: true } });
  for (const s of st) for (const f of `${s.title}. ${extractStoryPlainText(s.text ?? "")}`.split(/(?<=[.!?”])\s+/))
    if (/(^|[^\p{L}])noronha([^\p{L}]|$)/iu.test(f)) console.log(`${s.slug}\t${f.trim()}`);
  const g = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: "portuguese-traveler-brazil-b2", slug: "" } }, select: { slugs: true } });
  console.log(`bundle b2: ${g?.slugs.length} slugs`);
})().finally(() => p.$disconnect());
