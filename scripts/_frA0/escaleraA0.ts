// SOLO LECTURA. Replica journey-vocab-recirculation (validateJourneyStories.ts
// 746-797) sobre los journeys a0, y los mide en LOS DOS modos del checker:
// sin ancladas (media sobre todas, sin cola) y con ancladas (portables + cola).
//   npx tsx scripts/_frA0/escaleraA0.ts
import "dotenv/config";
import fs from "fs";
import { PrismaClient } from "@/generated/prisma";
const p = new PrismaClient();
const tok = (t: string) => (t.toLowerCase().match(/\p{L}+/gu) ?? []);
function mide(nombre: string, stories: Array<{ text: string; vocab: any[] }>) {
  const cuerpos = stories.map((s) => new Set(tok(s.text)));
  const textos = stories.map((s) => s.text.toLowerCase());
  const clave = (v: any) => String(v.surface ?? v.word).toLowerCase().replace(/^(der|die|das|le|la|el|il|o|a)\s+/, "");
  const enc = (v: any) => { const k = clave(v); if (!k.includes(" ")) return cuerpos.filter((c) => c.has(k)).length;
    const lema = String(v.word).toLowerCase(); return textos.filter((t) => t.includes(k) || t.includes(lema)).length; };
  const todas = stories.flatMap((s) => (s.vocab ?? []).map((v: any) => ({ n: enc(v), anchor: !!v.anchor })));
  const m = (xs: any[]) => xs.reduce((a, b) => a + b.n, 0) / (xs.length || 1);
  const cola = (xs: any[]) => xs.filter((x) => x.n <= 1).length;
  const port = todas.filter((x) => !x.anchor);
  const marcadas = todas.length - port.length;
  console.log(`${nombre.padEnd(34)} ${stories.length} hist · plazas ${todas.length} · ancladas marcadas ${marcadas}` +
    ` | TODAS: media ${m(todas).toFixed(2)}, cola ${cola(todas)}/${todas.length} (${Math.round(100 * cola(todas) / todas.length)}%)` +
    (marcadas ? ` | PORTABLES: media ${m(port).toFixed(2)}, cola ${cola(port)}/${port.length} (${Math.round(100 * cola(port) / port.length)}%)` : ""));
}
(async () => {
  const js: any[] = await p.journey.findMany({ where: { levels: { has: "a0" } } as any, select: { id: true, name: true, language: true, variant: true, status: true } as any });
  for (const j of js) {
    const st: any[] = await p.journeyStory.findMany({ where: { journeyId: j.id, text: { not: null } }, select: { text: true, vocab: true } as any });
    if (st.length >= 7) mide(`${j.status} ${j.name} ${j.language}/${j.variant}`, st);
  }
  const fr = ["t1","t2","t3","t4","t5","t6","t7"].flatMap((t) => JSON.parse(fs.readFileSync(`scripts/_frA0/${t}.json`, "utf8")));
  mide("FR Friends a0 (21, con el tema 7)", fr);
  await p.$disconnect();
})();
