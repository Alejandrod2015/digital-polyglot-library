// SOLO LECTURA. Escalera contando las formas flexionadas de cada plaza, con un
// generador de formas del frances (presente + infinitivo; concordancia del
// adjetivo; plural del sustantivo). Solo casa formas generadas desde el lema
// de la plaza: nada de prefijos. Lista las formas extra que casa, para revisar.
//   npx tsx scripts/_frA0/formasFR.ts
import fs from "fs";
const IRR: Record<string, string> = {
  aller: "vais vas va allons allez vont", faire: "fais fait faisons faites font", dire: "dis dit disons dites disent",
  pouvoir: "peux peut pouvons pouvez peuvent", vouloir: "veux veut voulons voulez veulent", savoir: "sais sait savons savez savent",
  venir: "viens vient venons venez viennent", tenir: "tiens tient tenons tenez tiennent", retenir: "retiens retient retenons retenez retiennent",
  prendre: "prends prend prenons prenez prennent", apprendre: "apprends apprend apprenons apprenez apprennent",
  comprendre: "comprends comprend comprenons comprenez comprennent", mettre: "mets met mettons mettez mettent",
  partir: "pars part partons partez partent", sortir: "sors sort sortons sortez sortent", dormir: "dors dort dormons dormez dorment",
  servir: "sers sert servons servez servent", sentir: "sens sent sentons sentez sentent", courir: "cours court courons courez courent",
  ouvrir: "ouvre ouvres ouvrons ouvrez ouvrent", offrir: "offre offres offrons offrez offrent", voir: "vois voit voyons voyez voient",
  boire: "bois boit buvons buvez boivent", lire: "lis lit lisons lisez lisent", écrire: "écris écrit écrivons écrivez écrivent",
  éteindre: "éteins éteint éteignons éteignez éteignent", peindre: "peins peint peignons peignez peignent", devoir: "dois doit devons devez doivent",
  rire: "ris rit rions riez rient", sourire: "souris sourit sourions souriez sourient", plaire: "plais plaît plaisons plaisez plaisent",
  connaître: "connais connaît connaissons connaissez connaissent", vivre: "vis vit vivons vivez vivent", croire: "crois croit croyons croyez croient",
  appeler: "appelle appelles appelons appelez appellent", rappeler: "rappelle rappelles rappelons rappelez rappellent",
  jeter: "jette jettes jetons jetez jettent", payer: "paie paies payons payez paient paye payes payent",
  essayer: "essaie essaies essayons essayez essaient essaye", balayer: "balaie balaies balayons balayez balaient balaye",
  être: "suis es est sommes êtes sont", avoir: "ai as a avons avez ont", falloir: "faut",
};
const verbo = (l: string): string[] => {
  if (IRR[l]) return [l, ...IRR[l].split(" ")];
  const f = [l];
  if (/er$/.test(l)) {
    const st = l.slice(0, -2);
    let fuerte = st;
    const m = /^(.*)([eé])([^aeiouyéèê]+)$/.exec(st);
    if (m) fuerte = m[1] + "è" + m[3];
    const nos = /c$/.test(st) ? st.slice(0, -1) + "ç" : /g$/.test(st) ? st + "e" : st;
    f.push(fuerte + "e", fuerte + "es", fuerte + "ent", nos + "ons", st + "ez");
  } else if (/ir$/.test(l)) {
    const st = l.slice(0, -2); f.push(st + "is", st + "it", st + "issons", st + "issez", st + "issent");
  } else if (/re$/.test(l)) {
    const st = l.slice(0, -2); f.push(st + "s", st, st + "ons", st + "ez", st + "ent");
  }
  return f;
};
const ADJ: Record<string, string> = { nouveau: "nouvel nouvelle nouveaux nouvelles", vieux: "vieil vieille vieilles", beau: "bel belle beaux belles",
  long: "longue longs longues", doux: "douce douces", gros: "grosse grosses", faux: "fausse fausses", blanc: "blanche blanches",
  gentil: "gentille gentils gentilles", bas: "basse basses", frais: "fraîche fraîches", sec: "sèche sèches" };
const adjetivo = (l: string): string[] => {
  if (ADJ[l]) return [l, ...ADJ[l].split(" ")];
  if (/e$/.test(l)) return [l, l + "s"];
  if (/eux$/.test(l)) return [l, l.slice(0, -1) + "se", l.slice(0, -1) + "ses"];
  if (/if$/.test(l)) return [l, l.slice(0, -1) + "ve", l + "s", l.slice(0, -1) + "ves"];
  if (/er$/.test(l)) return [l, l.slice(0, -2) + "ère", l + "s", l.slice(0, -2) + "ères"];
  if (/(el|en|on|et)$/.test(l)) return [l, l + l.slice(-1) + "e", l + "s", l + l.slice(-1) + "es"];
  if (/[sx]$/.test(l)) return [l, l + "e", l + "es"];
  return [l, l + "e", l + "s", l + "es"];
};
const sustantivo = (l: string): string[] => /[sxz]$/.test(l) ? [l] : /(au|eu)$/.test(l) ? [l, l + "x"] : /al$/.test(l) ? [l, l.slice(0, -2) + "aux"] : [l, l + "s"];
const tok = (t: string) => t.toLowerCase().replace(/’/g, "'").match(/\p{L}+/gu) ?? [];
const art = (w: string) => w.toLowerCase().replace(/’/g, "'").replace(/^(le |la |les |l'|se |s')/, "").trim();
for (const dir of ["scripts/_frA0/pasada2", "scripts/_frA0/pasada3"]) {
  const st = ["t1","t2","t3","t4","t5","t6","t7"].flatMap((t) => JSON.parse(fs.readFileSync(`${dir}/${t}.json`, "utf8")).map((s: any, i: number) => ({ ...s, id: `${t}#${i}` })));
  const cuerpos = st.map((s: any) => new Set(tok(s.text)));
  const low = st.map((s: any) => s.text.toLowerCase().replace(/’/g, "'"));
  const lit: number[] = [], lem: number[] = [], extra: string[] = [];
  // Homografos reales, uno a uno (forma igual, palabra distinta): la puerta no es
  // porter, el adjetivo vide no es vider, el verbo joues no es la mejilla, y el
  // reloj de t4#1 no es montrer. Solo se descartan en las historias donde la
  // forma es la OTRA palabra.
  const HOMO: Record<string, Record<string, string[]>> = {
    porter: { porte: ["*"], portes: ["*"] }, vider: { vide: ["*"] }, joue: { joues: ["*"] }, montrer: { montre: ["t4#1"] },
  };
  const vale = (l: string, w: string, id: string) => { const h = HOMO[l]?.[w]; return !h || !(h.includes("*") || h.includes(id)); };
  for (const s of st) for (const v of s.vocab) {
    if (v.anchor) continue;
    const sf = art(String(v.surface ?? v.word)), l = art(String(v.word));
    const multi = sf.includes(" ") || !/^\p{L}+$/u.test(sf) || l.includes(" ") || !/^\p{L}+$/u.test(l);
    const nl = multi ? low.filter((t: string) => t.includes(sf)).length : cuerpos.filter((c) => c.has(sf)).length;
    lit.push(nl);
    if (multi) { lem.push(nl); continue; }
    const ty = String(v.type);
    const formas = new Set([sf, ...(ty === "verb" ? verbo(l) : ty === "adjective" ? adjetivo(l) : ty === "noun" ? sustantivo(l) : [l])]);
    const n = cuerpos.filter((c, i) => [...formas].some((w) => c.has(w) && (w === sf || vale(l, w, st[i].id)))).length;
    lem.push(n);
    if (n > nl) extra.push(`${s.id} ${l} (${sf}) ${nl}->${n}: ${[...new Set(cuerpos.flatMap((c) => [...formas].filter((w) => w !== sf && c.has(w))))].join("/")}`);
  }
  const suma = (a: number[]) => a.reduce((x, y) => x + y, 0);
  console.log(`${dir.split("/").pop()}: literal ${suma(lit)}/294 = ${(suma(lit) / 294).toFixed(3)}, sueltos ${lit.filter((n) => n <= 1).length} | con formas ${suma(lem)}/294 = ${(suma(lem) / 294).toFixed(3)}, sueltos ${lem.filter((n) => n <= 1).length}`);
  if (dir.endsWith("pasada2")) console.log("  plazas que suben (formas extra que casan):\n  " + extra.join("\n  "));
}
