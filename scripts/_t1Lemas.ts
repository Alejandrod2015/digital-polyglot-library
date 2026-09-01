import * as fs from "fs";
const pal=fs.readFileSync("/tmp/t1-paleta.txt","utf8").split("\n").filter(Boolean);
const libres=new Set(fs.readFileSync("/tmp/t1-libres.txt","utf8").split("\n"));
const cat=(w:string)=>{
  if(w.includes(" ")) return "expresion";
  if(/(ar|er|ir|arse|erse|irse)$/.test(w)&&w.length>4) return "verbo?";
  if(/(mente)$/.test(w)) return "adverbio";
  if(/(oso|osa|ado|ada|ido|ida|ante|ible|able|ivo|iva|udo)$/.test(w)) return "adjetivo?";
  return "sustantivo?";
};
const out=["lema\tcategoria\tsolapa con otro tipo de journey"];
for(const w of pal) out.push(`${w}\t${cat(w)}\t${libres.has(w)?"no":"si (tope 2 por historia)"}`);
fs.writeFileSync("/tmp/a2-lemas-libres.tsv", out.join("\n"));
const n:Record<string,number>={}; for(const w of pal) n[cat(w)]=(n[cat(w)]??0)+1;
console.log(`/tmp/a2-lemas-libres.tsv · ${pal.length} lemas · ${JSON.stringify(n)}`);
