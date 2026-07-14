import * as fs from "fs";
const toks:string[]=JSON.parse(fs.readFileSync("scripts/_friends_tokens.json","utf8"));
const N=6, per=Math.ceil(toks.length/N);
for(let i=0;i<N;i++){
  const chunk=toks.slice(i*per,(i+1)*per);
  fs.writeFileSync(`scripts/_friends_tok_chunk_${i+1}.json`, JSON.stringify(chunk,null,0));
  console.log(`chunk ${i+1}: ${chunk.length} tokens`);
}
