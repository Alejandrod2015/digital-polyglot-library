import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const buscar = process.argv.slice(2).map((x) => x.toLowerCase());
  const rows = await p.journeyStory.findMany({
    where: { journey: { language: "spanish", status: { not: "archived" } }, journeyId: { not: "cmt5x67ze000l320cpgunu5vi" } },
    select: { slug: true, vocab: true, journey: { select: { name: true, variant: true, levels: true, typeSlug: true } } },
  });
  for (const r of rows) for (const v of ((r.vocab as Array<{word?:string}> ?? [])))
    if (v?.word && buscar.includes(String(v.word).toLowerCase()))
      console.log(`${String(v.word).padEnd(14)} ${r.journey?.name}/${r.journey?.variant}/${JSON.stringify(r.journey?.levels)} type=${r.journey?.typeSlug}  ${r.slug}`);
})().finally(() => p.$disconnect());
