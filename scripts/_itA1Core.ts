/** Que historias NO contienen cada palabra del nucleo portable. */
import * as fs from "fs";
const TOPICS = ["roads-and-driving","phones-and-signal","rooms-and-keys","forest-and-hiking","village-festivals","pharmacy-emergencies","bureaucracy-and-paperwork"];
const st = (JSON.parse(fs.readFileSync(process.argv[2], "utf8")) as any[])
  .sort((a,b)=>(TOPICS.indexOf(a.topic)-TOPICS.indexOf(b.topic))||(a.slotIndex-b.slotIndex));
const tok = (t: string) => (t.toLowerCase().match(/\p{L}+/gu) ?? []);
const cuerpos = st.map(s => new Set(tok(s.text)));
const CORE = "macchina cellulare coperta maglione documenti caviglia portiera busta panini graffio batteria cuscino torcia camicia scadenza credito giacca caffè consegna chiave benzina notte stanchezza sveglia mappa".split(" ");
for (const w of CORE) {
  const falta = st.map((s,i)=>[s.slug,i] as [string,number]).filter(([,i])=>!cuerpos[i].has(w));
  console.log(`${w.padEnd(14)} ${String(21-falta.length).padStart(2)}/21  falta en: ${falta.map(([s])=>s.slice(0,22)).join(", ")}`);
}
