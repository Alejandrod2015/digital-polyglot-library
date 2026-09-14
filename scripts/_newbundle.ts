/** Crea la fila global de un bundle nuevo con los slugs de un journey.
 *  Las glosas se dejan vacias: las rellena rebuildTapGlosses, que reutiliza
 *  lo que ya este glosado en los bundles hermanos del mismo idioma.
 *  npx tsx scripts/_newbundle.ts <bundle> <lang> <variant> <lvl>
 *  npx tsx scripts/_newbundle.ts <bundle> <lang> <variant> <lvl> --journey <id>
 *
 *  Sin --journey, el filtro es language+variant+levels y puede matchear MAS
 *  de un journey (dos journeys distintos comparten level cuando uno subio de
 *  nivel y conservo el bundle viejo: ver project_levels_raised_2026_09_10).
 *  Con --journey se ignoran language/variant/levels para elegir el journey y
 *  se usan solo para la fila del bundle; los slugs salen EXCLUSIVAMENTE de
 *  ese id. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
async function main(){
 const [bundle, language, variant, lvl] = process.argv.slice(2);
 const journeyIdIdx = process.argv.indexOf("--journey");
 const journeyId = journeyIdIdx >= 0 ? process.argv[journeyIdIdx + 1] : undefined;
 const js = journeyId
   ? await p.journey.findMany({ where: { id: journeyId }, select: { stories: { select: { slug: true } } } })
   : await p.journey.findMany({ where: { status: { in: ["active","draft"] }, language, variant, levels: { has: lvl } }, select: { stories: { select: { slug: true } } } });
 if (journeyId && js.length !== 1) throw new Error(`--journey ${journeyId} no encontro exactamente 1 journey (encontro ${js.length})`);
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
