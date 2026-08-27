import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
async function main(){
 const [bundle, ...nuevos] = process.argv.slice(2);
 const g = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle, slug: "" } } });
 const slugs = [...new Set([...g!.slugs, ...nuevos])];
 await p.tapGlossSet.update({ where: { bundle_slug: { bundle, slug: "" } }, data: { slugs } });
 console.log(`${bundle}: ${g!.slugs.length} -> ${slugs.length} slugs`);
 await p.$disconnect();
}
main();
