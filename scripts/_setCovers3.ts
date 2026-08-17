import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import * as fs from "fs";
const p = new PrismaClient();
const SC = "/private/tmp/claude-501/-Users-alejandrodelcarpio-digital-polyglot-library/1a5ef0dc-8a56-454e-9f1b-b766ccf19b71/scratchpad";
const r2 = fs.readFileSync(`${SC}/round2_urls.txt`, "utf8").split("\n");
const t1 = fs.readFileSync(`${SC}/topic1_urls.txt`, "utf8").split("\n");
const find = (arr: string[], key: string) => (arr.find((l) => l.startsWith(key + " ")) || "").split(" ")[1] || "";
const buerg = find(r2, "2");        // estilo B
const spaeti = find(t1, "spaeti");
const stempel = find(t1, "stempel");
const M: Array<[string, string]> = [
  ["cmr92f0xa000232ffcv412c5k", buerg],
  ["cmr92f141000432ffq1nqs86b", spaeti],
  ["cmr92f16x000632ffiyonegzx", stempel],
];
(async () => {
  for (const item of M) {
    const id = item[0]; const url = item[1];
    if (!url) { console.log("SKIP", id); continue; }
    const r = await p.journeyStory.update({ where: { id }, data: { coverUrl: url, coverDone: true }, select: { slug: true } });
    console.log("live:", (r as any).slug, "->", url.slice(-40));
  }
})().finally(() => p.$disconnect());
