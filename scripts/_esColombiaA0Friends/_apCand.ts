import fs from "node:fs";
const hist = JSON.parse(fs.readFileSync("scripts/_esColombiaA0Friends/historias.json","utf8"));
const lineas = fs.readFileSync(process.argv[2],"utf8").split("\n");
const vistos = new Map<string,{slug:string;es:string}>();
for (const l of lineas) {
  const m = l.match(/^\s*([a-z0-9-]+) \| (\S+) \| (.+)$/);
  if (!m) continue;
  const [, slug, w, frase] = m;
  const esc = w.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  const reW = new RegExp("(^|[^\\p{L}])"+esc+"([^\\p{L}]|$)","iu");
  const pal = frase.trim().split(/\s+/);
  let frag = frase.trim();
  if (pal.length > 8) {
    const i = pal.findIndex(x => reW.test(" "+x+" "));
    const ini = Math.max(0, Math.min(i - 4, pal.length - 8));
    frag = pal.slice(ini, ini + 8).join(" ");
  }
  frag = frag.replace(/^[,;:\s]+|[\s,;:.]+$/g,"");
  const k = slug + "||" + frag;
  if (!vistos.has(k)) vistos.set(k, { slug, es: frag });
}
const filas = [...vistos.values()];
fs.writeFileSync("scripts/_esColombiaA0Friends/apariciones.json", JSON.stringify(filas.map(f=>({slug:f.slug,es:f.es,en:""})), null, 1));
for (const f of filas) console.log(f.slug + "\t" + f.es);
console.error(filas.length + " trozos");
