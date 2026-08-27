/** Crea la fila global de un bundle nuevo con los slugs de un journey.
 *  Las glosas se dejan vacias: las rellena rebuildTapGlosses, que reutiliza
 *  lo que ya este glosado en los bundles hermanos del mismo idioma.
 *  npx tsx scripts/_newbundle.ts <bundle> <lang> <variant> <lvl> */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
async function main(){
 const [bundle, language, variant, lvl] = process.argv.slice(2);
 const js = await p.journey.findMany({ where: { status: { in: ["active","draft"] }, language, variant, levels: { has: lvl } }, select: { stories: { select: { slug: true } } } });
 const slugs = js.flatMap(j => j.stories.map(s => s.slug!)).filter(Boolean);
 await p.tapGlossSet.upsert({
   where: { bundle_slug: { bundle, slug: "" } },
   create: { bundle, slug: "", language, variant, slugs, glosses: {} },
   update: { slugs, language, variant },
 });
 console.log(`${bundle}: ${slugs.length} historias`);
 await p.$disconnect();
}
main();
