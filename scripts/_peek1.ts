import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
async function main(){
 const [b,s,w]=process.argv.slice(2);
 const f = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: b, slug: s } } });
 console.log("DB  :", JSON.stringify((f!.glosses as any)[w]?.f));
 await p.$disconnect();
}
main();
