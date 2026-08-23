import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import { PrismaClient } from "../src/generated/prisma";
import { ITALIAN_A1_A2_LEMMAS } from "../src/lib/cefr/italianA1A2";
const prisma = new PrismaClient();
const STOP = new Set(("il lo la i gli le un uno una del dello della dei degli delle io tu lui lei noi voi loro mio tuo suo nostro vostro questo questa quello quella tale stesso altro tutto ogni qualche e o ma però perché quando mentre se anche ancora già in a da di con su per tra fra verso durante contro senza sopra sotto non no sì forse mai sempre spesso raramente adesso poi dopo prima presto tardi oggi domani ieri ora qui qua lì là dentro fuori davanti dietro giù molto poco abbastanza troppo quasi appena solo neanche subito zero uno due tre quattro cinque sei sette otto nove dieci undici dodici tredici quattordici quindici sedici diciassette diciotto diciannove venti trenta quaranta cinquanta sessanta settanta ottanta novanta cento mille milione primo secondo terzo lunedì martedì mercoledì giovedì venerdì sabato domenica gennaio febbraio marzo aprile maggio giugno luglio agosto settembre ottobre novembre dicembre essere avere fare potere dovere volere sapere ogni tanto bene male").split(/\s+/));
async function run(){
const trav="cmss0fkc40007j8dub1zpa1kc";
const rows = await prisma.journeyStory.findMany({ where: { journeyId: trav }, select: { vocab: true } });
const A0=new Set<string>(); for (const r of rows) for (const v of ((r.vocab as any[])??[])) A0.add(String(v.word));
const free=[...(ITALIAN_A1_A2_LEMMAS as Set<string>)].filter(w=>!A0.has(w)&&!STOP.has(w)&&!/\s/.test(w));
console.log(`POOL UTIL = ${free.length} (lista ${ (ITALIAN_A1_A2_LEMMAS as Set<string>).size } - A0 ${A0.size} - funcionales)`);
console.log(free.sort((a,b)=>a.localeCompare(b,"it")).join(" | "));
await prisma.$disconnect();
}
run();
