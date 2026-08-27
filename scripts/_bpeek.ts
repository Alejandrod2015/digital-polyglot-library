import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
async function main(){
 const g = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: process.argv[2], slug: "" } } });
 console.log("language:", JSON.stringify(g!.language), "variant:", JSON.stringify(g!.variant), "slugs:", g!.slugs.length);
 const j = await p.journeyStory.findMany({ where: { slug: { in: g!.slugs.slice(0,3) } }, select: { journey: { select: { name: true, language: true, variant: true, levels: true, status: true } } } });
 console.log(JSON.stringify(j[0]?.journey));
 await p.$disconnect();
}
main();
