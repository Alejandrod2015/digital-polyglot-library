import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
async function main(){
 const [bundle, lang, vari, lvl] = process.argv.slice(2);
 const g = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle, slug: "" } } });
 const js = await p.journey.findMany({ where: { status: { in: ["active","draft"] }, language: lang, variant: vari, levels: { has: lvl } }, select: { stories: { select: { slug: true } } } });
 const todos = js.flatMap(j => j.stories.map(s => s.slug!)).filter(Boolean);
 console.log("fuera del array:", todos.filter(s => !g!.slugs.includes(s)).join(" ") || "ninguno");
 await p.$disconnect();
}
main();
