import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import * as fs from "fs";
const p = new PrismaClient();
const SC = process.env.SC as string;
(async () => {
  const rows = await p.journeyStory.findMany({
    where: { journeyId: "cmr92f0qz000032ff1dfd4fgx" },
    select: { id: true, slug: true, title: true, text: true, coverDone: true, coverUrl: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  const out = rows.map((r: any, i: number) => ({ n: i+1, id: r.id, slug: r.slug, title: r.title, coverDone: r.coverDone, text: r.text }));
  fs.writeFileSync(`${SC}/all21.json`, JSON.stringify(out, null, 1));
  console.log("total:", rows.length, "| coverDone:", rows.filter((r:any)=>r.coverDone).length, "| sin cover:", rows.filter((r:any)=>!r.coverDone).length);
  out.forEach((r:any)=>console.log(`${r.coverDone?"[C]":"[ ]"} ${String(r.n).padStart(2)} ${r.slug}`));
})().finally(() => p.$disconnect());
