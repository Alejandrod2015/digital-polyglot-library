import * as fs from "fs";
import { renderedParagraphs } from "/Users/alejandrodelcarpio/digital-polyglot-library/src/lib/readerParagraphs";
const a0=JSON.parse(fs.readFileSync(__dirname+"/de-a0-final.json","utf8"));
const s=a0[20];
renderedParagraphs(String(s.text)).forEach((b:string,i:number)=>{
  const hit=s.vocab.filter((v:any)=>b.includes(v.surface)).map((v:any)=>v.surface);
  console.log(`bloque ${i+1} (${hit.length}): ${hit.join(", ")}`);
  if(hit.length>=5) console.log("   >>", b.slice(0,120));
});
