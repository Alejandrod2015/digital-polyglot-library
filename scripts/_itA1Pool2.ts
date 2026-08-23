import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import { PrismaClient } from "../src/generated/prisma";
import { ITALIAN_A1_A2_LEMMAS } from "../src/lib/cefr/italianA1A2";
const prisma = new PrismaClient();
const STOP = new Set(("il lo la i gli le un uno una del dello della dei degli delle io tu lui lei noi voi loro mio tuo suo nostro vostro questo questa quello quella tale stesso altro tutto ogni qualche e o ma però perché quando mentre se anche ancora già in a da di con su per tra fra verso durante contro senza sopra sotto non no sì forse mai sempre spesso raramente adesso poi dopo prima presto tardi oggi domani ieri ora qui qua lì là dentro fuori davanti dietro giù molto poco abbastanza troppo quasi appena solo neanche subito zero uno due tre quattro cinque sei sette otto nove dieci undici dodici tredici quattordici quindici sedici diciassette diciotto diciannove venti trenta quaranta cinquanta sessanta settanta ottanta novanta cento mille milione primo secondo terzo essere avere fare potere dovere volere sapere bene male meglio peggio certo").split(/\s+/));
async function run(){
const trav="cmss0fkc40007j8dub1zpa1kc", fr="cmrsiz1n40000320d6h8p8f5g";
const rows = await prisma.journeyStory.findMany({ where: { journeyId: { in: [trav, fr] } }, select: { journeyId:true, vocab:true } });
const A0=new Set<string>(), SOFT=new Set<string>();
for (const r of rows) for (const v of ((r.vocab as any[])??[])) (r.journeyId===trav?A0:SOFT).add(String(v.word));
const L=[...(ITALIAN_A1_A2_LEMMAS as Set<string>)].filter(x=>!STOP.has(x)&&!/\s/.test(x));
const libre=L.filter(x=>!A0.has(x)&&!SOFT.has(x)).sort((a,b)=>a.localeCompare(b,"it"));
const blanda=L.filter(x=>!A0.has(x)&&SOFT.has(x)).sort((a,b)=>a.localeCompare(b,"it"));
console.log(`LIBRE (${libre.length}) - se pueden ensenar sin limite:\n${libre.join(" ")}\n`);
console.log(`BLANDA (${blanda.length}) - max 2 por historia:\n${blanda.join(" ")}`);
await prisma.$disconnect();
}
run();
