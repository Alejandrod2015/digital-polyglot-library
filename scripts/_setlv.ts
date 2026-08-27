import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
async function main(){
 const [bundle, language, variant] = process.argv.slice(2);
 await p.tapGlossSet.updateMany({ where: { bundle }, data: { language, variant } });
 console.log(`${bundle}: language=${language} variant=${variant}`);
 await p.$disconnect();
}
main();
