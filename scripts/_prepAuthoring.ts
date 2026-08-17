import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import * as fs from "fs";
const prisma = new PrismaClient();
const SP = process.env.SP!;
const norm = (s:string)=>(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").trim();
const firstTok=(s:string)=>norm(s).split(/\s+/)[0]??"";
const cp=(a:string,b:string)=>{let i=0;while(i<a.length&&i<b.length&&a[i]===b[i])i++;return i;};
const covers=(t:string,v:string)=>{const[w,sf]=v.split("||");const a=norm(t),b=norm(w);if(!a||!b)return false;if(a===b)return true;if(sf&&a===norm(sf))return true;const ta=firstTok(a),tb=firstTok(b);const L=cp(ta,tb);return L>=Math.max(3,Math.min(ta.length,tb.length)-3);};
const J="cmrrqjd2n000032nvnp2tryzg";
const blocked=["rosa-nada-primero","sofia-prueba-el-mole","la-talavera-azul","xochimilco-en-trajinera","suena-el-mariachi","el-mar-es-turquesa","sofia-sube-a-monte-alban","la-salsa-quema","la-casa-azul-de-coyoacan","el-mole-poblano","tengo-un-poco-de-miedo","una-noche-de-callejoneada","pablo-pinta-un-gato","diego-pinta-alebrijes","los-dos-volcanes","el-mercado-del-zocalo","las-ruinas-miran-al-mar"];
(async()=>{
  const stories=await prisma.journeyStory.findMany({where:{journeyId:J,slug:{in:blocked}},select:{slug:true,vocab:true,text:true}});
  for(const s of stories){
    const setPath=`scripts/_sets/${s.slug}.json`;
    const exs=JSON.parse(fs.readFileSync(setPath,"utf8"));
    const targets:string[]=[];
    for(const e of exs){ if(e.type==="match_meaning"){for(const pr of (e.payload?.pairs??[]))targets.push(pr.word);} else if(e.word) targets.push(e.word); }
    const vocab=((s.vocab as any[])??[]).map(v=>({word:v.word,surface:v.surface??v.word,def:v.definition??v.def??v.translation??"",type:v.type??"",ex:v.ex??v.exampleSentence??""}));
    const vocabEntries=vocab.map(v=>v.surface?`${v.word}||${v.surface}`:v.word);
    const uncoveredEntries=vocabEntries.filter(v=>!targets.some(t=>covers(t,v)));
    const uncoveredWords=new Set(uncoveredEntries.map(v=>v.split("||")[0]));
    const uncovered=vocab.filter(v=>uncoveredWords.has(v.word));
    fs.writeFileSync(`${SP}/authoring/${s.slug}.json`, JSON.stringify({slug:s.slug, storyText:(s as any).text, usedTargets:targets, uncovered, allVocab:vocab},null,1));
    console.log(`${s.slug}\tuncovered=${uncovered.length}`);
  }
  await prisma.$disconnect();
})();
