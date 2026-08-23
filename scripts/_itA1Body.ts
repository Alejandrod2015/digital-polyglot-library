/** Regla i+2 sobre el CUERPO (no solo el vocab) y forma de la escalera. */
import * as fs from "fs";
import { ITALIAN_A1_A2_LEMMAS, isItalianA1A2 } from "../src/lib/cefr/italianA1A2";
const st = JSON.parse(fs.readFileSync(process.argv[2], "utf8")) as any[];
const STOP = new Set(("il lo la i gli le un uno una l del dello della dei degli delle nel nella nei negli nelle al allo alla ai agli alle dal dalla dai sul sulla sui col io tu lui lei noi voi loro mio mia suo sua sue suoi tuo che chi cui non ne ci si se ci e o ma però perché quando mentre anche ancora già in a da di con su per tra fra senza sopra sotto dentro fuori davanti dietro giù qui qua lì là più meno molto poco troppo quasi appena solo sempre mai spesso adesso poi dopo prima presto tardi oggi domani ieri come cosa quello questo questa quella quelli queste tutti tutto tutte ogni qualcosa qualcuno nessuno niente c'è ci sono essere avere fare stare andare venire potere dovere volere sapere dire vedere dare sono è sei siamo siete ha ho hai abbiamo avete hanno era erano fa fanno va vanno viene vengono dice dicono").split(/\s+/));
const rows: string[] = [];
for (const s of st) {
  const voc = new Set((s.vocab ?? []).map((v:any)=>String(v.surface??v.word).toLowerCase()));
  const toks = (s.text.toLowerCase().match(/\p{L}+/gu) ?? []) as string[];
  const fuera = [...new Set(toks)].filter(t => t.length>3 && !STOP.has(t) && !voc.has(t) && !isItalianA1A2(t));
  const port = (s.vocab??[]).filter((v:any)=>["verb","adjective","adverb","expression"].includes(v.type)).length;
  rows.push(`${String(s.slug).padEnd(34)} fuera-de-lista-en-cuerpo=${String(fuera.length).padStart(2)}  verbos+adj=${String(port).padStart(2)}/${(s.vocab??[]).length}  ${fuera.slice(0,10).join(" ")}`);
}
console.log(rows.join("\n"));
