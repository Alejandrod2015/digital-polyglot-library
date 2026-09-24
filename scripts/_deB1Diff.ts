/** Que hay guardado de verdad: base contra ficheros, historia a historia. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import * as fs from "fs";
import { PrismaClient } from "../src/generated/prisma";
const J = "cmufhdbsj0007j8rotoym061z";
const DIR = "/Users/alejandrodelcarpio/digital-polyglot-library/.claude/worktrees/de-b1-friends-texto/scripts/_deB1Friends";
const first = (t:string) => { const p=t.split(/\n{2,}/)[0]??""; return (p.split(/(?<=[.!?])\s/)[0]??p).trim(); };
(async () => {
  const p = new PrismaClient();
  const j = await p.journey.findUnique({ where:{id:J}, select:{topics:true} });
  const db = await p.journeyStory.findMany({ where:{journeyId:J}, select:{topic:true,slotIndex:true,text:true,updatedAt:true} });
  const porTema = new Map<string,{ig:number,dif:number,when:string}>();
  for (let i=1;i<=7;i++) {
    const rows = JSON.parse(fs.readFileSync(`${DIR}/t${i}.json`,"utf8"));
    for (const s of rows) {
      const d = db.find(x=>x.topic===s.topic && x.slotIndex===s.slotIndex);
      const igual = (d?.text||"").trim() === String(s.text).trim();
      const cur = porTema.get(s.topic) ?? {ig:0,dif:0,when:""};
      cur[igual?"ig":"dif"]++; cur.when = d!.updatedAt.toISOString().slice(0,19);
      porTema.set(s.topic, cur);
    }
  }
  console.log("tema                              base=fichero  distintos  ultima escritura");
  for (const t of j!.topics) { const c = porTema.get(t)!; console.log(`${t.padEnd(33)} ${String(c.ig).padStart(6)}/3 ${String(c.dif).padStart(9)}  ${c.when}`); }
  const total = [...porTema.values()].reduce((a,b)=>a+b.dif,0);
  console.log(`\nhistorias con el fichero SIN guardar: ${total}/21`);
  await p.$disconnect();
})();
