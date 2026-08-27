import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
async function main(){
 const bundle = process.argv[2];
 const g = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle, slug: "" } } });
 const hist = await p.journeyStory.findMany({ where: { slug: { in: g!.slugs } }, select: { slug: true } });
 const vivos = new Set(hist.map(h => h.slug!));
 const huerfanos = g!.slugs.filter(s => !vivos.has(s));
 console.log("huerfanos:", huerfanos.join(" ") || "ninguno");
 if (process.argv.includes("--limpia") && huerfanos.length) {
   await p.tapGlossSet.update({ where: { bundle_slug: { bundle, slug: "" } }, data: { slugs: g!.slugs.filter(s => vivos.has(s)) } });
   await p.tapGlossSet.deleteMany({ where: { bundle, slug: { in: huerfanos } } });
   console.log("quitados del array");
 }
 await p.$disconnect();
}
main();
