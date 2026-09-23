import fs from "node:fs";
const hist = JSON.parse(fs.readFileSync("scripts/_esColombiaA0Friends/historias.json","utf8"));
const txt = fs.readFileSync(process.argv[2],"utf8");
const porSlug: Record<string,string[]> = {};
for (const line of txt.split("\n")) {
  const m = line.match(/^\s+([a-z0-9-]+): \d+ sin contexto \(([^)]*)\)/);
  if (m) porSlug[m[1]] = m[2].split(", ").map(s=>s.trim());
}
const out: Record<string, Record<string,{es:string,en:string}>> = {};
for (const [slug, palabras] of Object.entries(porSlug)) {
  const st = hist.stories.find((s:any)=>s.slug===slug);
  const parrafos = (st.title + ".\n" + st.text).split(/\n+/);
  out[slug] = {};
  for (const w of palabras) {
    const esc = w.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
    const reW = new RegExp("(^|[^\\p{L}])"+esc+"([^\\p{L}]|$)","iu");
    let mejor = "";
    for (const p of parrafos) {
      for (const fr of p.split(/(?<=[.!?])\s+/)) {
        if (!reW.test(fr)) continue;
        const pal = fr.trim().split(/\s+/);
        let frag = fr.trim();
        if (pal.length > 8) {
          const i = pal.findIndex(x => reW.test(" "+x+" "));
          const ini = Math.max(0, Math.min(i - 4, pal.length - 8));
          frag = pal.slice(ini, ini + 8).join(" ");
        }
        frag = frag.replace(/^[,;:\s]+|[\s,;:.]+$/g,"");
        if (frag.split(/\s+/).length > mejor.split(/\s+/).filter(Boolean).length || !mejor) { mejor = frag; }
        break;
      }
      if (mejor) break;
    }
    out[slug][w] = { es: mejor, en: "" };
  }
}
fs.writeFileSync("scripts/_esColombiaA0Friends/sueltas.json", JSON.stringify(out, null, 1));
for (const [slug, m] of Object.entries(out)) for (const [w,v] of Object.entries(m)) console.log(slug+"\t"+w+"\t"+v.es);
