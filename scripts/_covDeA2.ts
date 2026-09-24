import "./_loadEnv";
import { PrismaClient } from "../src/generated/prisma";
import { checkMasterCoverage } from "./coverageWhisperCheck";
const p = new PrismaClient();
(async()=>{
  for (const slug of process.argv.slice(2)) {
    const s:any = await p.journeyStory.findFirst({ where:{ journeyId:'cmubidgaf0007j8np6g7n89iu', slug }, select:{title:true,text:true,audioUrl:true} });
    console.log(`\n== ${slug}\nmaster: ${s.audioUrl}`);
    const cov = await checkMasterCoverage(s.audioUrl, s.text, "german", s.title);
    console.log(`cobertura: ${cov.ok ? "OK" : "FALLA"}`);
    for (const g of cov.gaps) console.log(`  HUECO: ${g.textWords.join(" ")}`);
    for (const d of cov.duplicates) console.log(`  DUPLICADO: ${d.words.join(" ")}`);
  }
  await p.$disconnect();
})();
