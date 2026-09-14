// SOLO LECTURA. journey-vocab-recirculation antes y despues del arreglo de
// guion/apostrofo: estado real del checker + medida replicada con la regla
// vieja (token por letras) y la nueva (pieza entera con bordes de letra).
//   npx tsx scripts/_frA0/guionTest.ts
import "dotenv/config";
import fs from "fs";
import { PrismaClient } from "@/generated/prisma";
import { validateJourneyStories } from "@/lib/validateJourneyStories";
const p = new PrismaClient();
const tok = (t: string) => (t.toLowerCase().match(/\p{L}+/gu) ?? []);
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function mide(nombre: string, stories: any[], lang: string, level: string, journeyType?: string) {
  const cuerpos = stories.map((s) => new Set(tok(s.text)));
  const textos = stories.map((s) => s.text.toLowerCase().replace(/’/g, "'"));
  const clave = (v: any) => String(v.surface ?? v.word).toLowerCase().replace(/’/g, "'").replace(/^(der|die|das|le|la|el|il|o|a)\s+/, "");
  const multi = (v: any, k: string) => { const lema = String(v.word).toLowerCase(); return textos.filter((t) => t.includes(k) || t.includes(lema)).length; };
  const vieja = (v: any) => { const k = clave(v); return k.includes(" ") ? multi(v, k) : cuerpos.filter((c) => c.has(k)).length; };
  const nueva = (v: any) => { const k = clave(v); if (k.includes(" ")) return multi(v, k);
    if (/^\p{L}+$/u.test(k)) return cuerpos.filter((c) => c.has(k)).length;
    const re = new RegExp(`(?<!\\p{L})${esc(k)}(?!\\p{L})`, "u"); return textos.filter((t) => re.test(t)).length; };
  const res = (f: (v: any) => number) => {
    const todas = stories.flatMap((s) => (s.vocab ?? []).map((v: any) => ({ n: f(v), anchor: !!v.anchor })));
    const marca = todas.some((x) => x.anchor); const xs = marca ? todas.filter((x) => !x.anchor) : todas;
    const media = xs.reduce((a, b) => a + b.n, 0) / xs.length; const sueltos = xs.filter((x) => x.n <= 1).length;
    return `media ${media.toFixed(2)} · sueltos ${sueltos}/${xs.length} (${Math.round(100 * sueltos / xs.length)}%)${marca ? " [portables]" : " [todas]"}`;
  };
  const conGuion = stories.flatMap((s) => (s.vocab ?? []).map((v: any) => clave(v))).filter((k) => !k.includes(" ") && !/^\p{L}+$/u.test(k));
  const jc = validateJourneyStories(stories as never, { language: lang, level, conjuntoCompleto: true, journeyType });
  const c: any = jc.find((c: any) => c.id === "journey-vocab-recirculation");
  console.log(`${nombre}\n   checker: ${c?.status}\n   regla vieja: ${res(vieja)}\n   regla nueva: ${res(nueva)}\n   plazas con guion/apostrofo (${conGuion.length}): ${conGuion.slice(0, 12).join(", ")}`);
}
(async () => {
  const fr = ["t1","t2","t3","t4","t5","t6","t7"].flatMap((t) => JSON.parse(fs.readFileSync(`scripts/_frA0/${t}.json`, "utf8")))
    .map((s: any) => ({ slug: `${s.topic}#${s.slotIndex}`, title: s.title, text: s.text, vocab: s.vocab, language: "FR", level: "a0", topic: s.topic }));
  mide("Friends FR a0 (21, JSON)", fr, "FR", "a0", "relationships");
  const es: any = await p.journey.findFirst({ where: { language: "spanish", variant: "spain", name: "Traveler", levels: { has: "b1" }, status: { not: "archived" } } as any, select: { id: true, typeSlug: true } as any });
  for (const [nombre, id, lang, level] of [["PT B1 (cmtrcpgso00073232h8vaf7na)", "cmtrcpgso00073232h8vaf7na", "portuguese", "b1"], [`Traveler ES spain b1 (${es?.id})`, es?.id, "spanish", "b1"]] as const) {
    const j: any = await p.journey.findUnique({ where: { id } as any, select: { typeSlug: true } as any });
    const st: any[] = await p.journeyStory.findMany({ where: { journeyId: id, text: { not: null } } as any, select: { slug: true, title: true, text: true, vocab: true, topic: true } as any });
    mide(`${nombre} · ${st.length} historias`, st.map((s) => ({ ...s, title: s.title ?? "", language: lang, level })), lang, level, j?.typeSlug);
  }
  await p.$disconnect();
})();
