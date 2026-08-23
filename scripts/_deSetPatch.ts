/**
 * Reajusta los sets curados despues de reequilibrar el vocab: quita el
 * ejercicio cuya palabra ya no se enseña y escribe uno por cada plaza nueva.
 *
 * Las plazas nuevas son palabras que YA se enseñan en otra historia, asi que la
 * glosa y los tres distractores hechos a mano ya existen y se reutilizan: lo
 * unico que se escribe de cero es la ORACION, que tiene que salir del cuerpo de
 * ESTA historia. Copiar tambien la oracion dejaria la misma frase en dos sets.
 *
 *   npx tsx scripts/_deSetPatch.ts [--write]
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import * as fs from "fs";
const p = new PrismaClient();
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const ART_HEAD = /^(der|die|das|den|dem|des|ein|eine|le|la|les|l|el|los|las|il|lo|gli|un|une|o|a|os|as)$/;
const firstTok = (s: string) => {
  const p = norm(s).split(/\s+/).filter(Boolean);
  if (!p.length) return "";
  return p.length > 1 && ART_HEAD.test(p[0]) ? p[p.length - 1] : p[0];
};
const pref = (a: string, b: string) => { let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++; return i; };
const cubre = (t: string, w: string, sf: string) => {
  const a = norm(t); if (a === norm(w) || a === norm(sf)) return true;
  const ta = firstTok(a), tb = firstTok(norm(w));
  return pref(ta, tb) >= Math.max(3, Math.min(ta.length, tb.length) - 3);
};
const NOMBRES: Array<[string, string]> = [
  ["Hannahs", "ihre"], ["Noahs", "seine"], ["Emilias", "ihre"], ["Maries", "ihre"], ["Leons", "seine"],
  ["Hannah", "Sie"], ["Sophie", "Sie"], ["Emilia", "Sie"], ["Marie", "Sie"],
  ["Elias", "Er"], ["Noah", "Er"], ["Leon", "Er"],
];
function sinNombres(f: string): string {
  let out = f;
  for (const [n, pro] of NOMBRES) {
    out = out.replace(new RegExp(`\\b${n}\\b`, "gu"), (m, off) => (off === 0 ? pro : pro.toLowerCase()));
  }
  // Dos pronombres seguidos por sustituir dos nombres en la misma frase.
  return out.replace(/\b(Sie|Er)\s+und\s+(sie|er)\b/g, "die beiden");
}

/** Clausula de <=14 palabras del cuerpo que contiene la superficie. */
function clausula(text: string, sf: string): string | null {
  const fr = text.replace(/\s*\n+\s*/g, " ").split(/(?<=[.!?”])\s+/)
    .map((f) => f.replace(/[“”]/g, "").trim()).filter(Boolean);
  const re = new RegExp(`\\b${sf.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\b`, "iu");
  const con = fr.filter((f) => re.test(f));
  if (!con.length) return null;
  // Sin nombre de personaje primero: el TTS engarruña los nombres y la QA de
  // transcripcion rechaza el clip ([[feedback_practice_exercise_authoring_rules]]
  // regla 8). Si no hay ninguna clausula limpia, el nombre se cambia por su
  // pronombre, que es lo que hace la version escrita a mano.
  const conNombre = (f: string) => NOMBRES.some(([n]) => new RegExp(`\\b${n}`, "u").test(f));
  con.sort((a, b) => (Number(conNombre(a)) - Number(conNombre(b))) ||
                     (a.split(/\s+/).length - b.split(/\s+/).length));
  for (const f of con) if (f.split(/\s+/).length <= 14) return f;
  const f = con[0];
  for (const trozo of f.split(/,\s*/)) if (re.test(trozo) && trozo.split(/\s+/).length <= 14)
    return trozo.replace(/[.,;:]$/, "") + ".";
  return f.split(/\s+/).slice(0, 14).join(" ");
}
(async () => {
  const write = process.argv.includes("--write");
  const j = await p.journey.findUnique({ where: { id: "cmt0a8vb1000m32p1x7r5ba28" }, select: { topics: true } });
  const orden = j?.topics ?? [];
  const st = (await p.journeyStory.findMany({
    where: { journeyId: "cmt0a8vb1000m32p1x7r5ba28" },
    select: { slug: true, topic: true, slotIndex: true, text: true, vocab: true },
  })).sort((a, b) => (orden.indexOf(a.topic) - orden.indexOf(b.topic)) || (a.slotIndex - b.slotIndex));

  const sets = new Map<string, any[]>();
  for (const s of st) sets.set(s.slug!, JSON.parse(fs.readFileSync(`scripts/_sets/${s.slug}.json`, "utf8")));
  // Catalogo de glosas ya escritas a mano, por palabra.
  const glosas = new Map<string, { answer: string; options: string[] }>();
  for (const exs of sets.values()) for (const e of exs) {
    if (e.type !== "meaning_in_context") continue;
    glosas.set(norm(e.word), { answer: e.payload.answer, options: e.payload.options });
  }

  // Glosas escritas a mano para las plazas nuevas cuyo unico ejercicio previo
  // era un `fill_blank`, que no lleva glosa de significado.
  const AMANO: Record<string, { answer: string; options: string[] }> = {
    "kalt": { answer: "cold", options: ["cold", "warm", "wet", "heavy"] },
    "zurück": { answer: "back, the way you came", options: ["back, the way you came", "ahead, further on", "upwards", "nearby"] },
    "voll": { answer: "full", options: ["full", "empty", "narrow", "clean"] },
    "bleiben": { answer: "to stay in a place", options: ["to stay in a place", "to leave a place", "to reach a place", "to look for a place"] },
    "warten": { answer: "to wait for someone", options: ["to wait for someone", "to call someone", "to follow someone", "to greet someone"] },
    "klein": { answer: "small", options: ["small", "big", "long", "heavy"] },
    "laut": { answer: "loud", options: ["loud", "quiet", "slow", "dark"] },
    "legen": { answer: "to lay something down", options: ["to lay something down", "to pick something up", "to throw something", "to buy something"] },
    "schnell": { answer: "fast", options: ["fast", "slow", "quiet", "late"] },
    "riechen": { answer: "to smell of something", options: ["to smell of something", "to taste of something", "to sound like something", "to look like something"] },
    "kurz": { answer: "short", options: ["short", "long", "wide", "deep"] },
    "wohnen": { answer: "to live in a place", options: ["to live in a place", "to work in a place", "to visit a place", "to leave a place"] },
    "dunkel": { answer: "dark", options: ["dark", "bright", "warm", "loud"] },
    "nicken": { answer: "to nod", options: ["to nod", "to shrug", "to wave", "to point"] },
    "ganz": { answer: "whole, entire", options: ["whole, entire", "half", "empty", "broken"] },
    "ziehen": { answer: "to pull something", options: ["to pull something", "to push something", "to lift something", "to drop something"] },
    "die Treppe": { answer: "stairs", options: ["stairs", "a bridge", "a gate", "a wall"] },
    "der Platz": { answer: "a public square", options: ["a public square", "a narrow lane", "a train station", "a garden"] },
    "der Tisch": { answer: "a table", options: ["a table", "a chair", "a shelf", "a bed"] },
    "der Laden": { answer: "a shop", options: ["a shop", "a kitchen", "a workshop", "a market stall"] },
  };
  let quitados = 0, puestos = 0, sinGlosa: string[] = [], sinClausula: string[] = [];
  for (const s of st) {
    const exs = sets.get(s.slug!)!;
    const voc = ((s.vocab as any[]) ?? []);
    const vivos = exs.filter((e) => e.type === "match_meaning" ||
      voc.some((v) => cubre(String(e.word), String(v.word), String(v.surface ?? v.word))));
    // El `match_meaning` enseña cuatro palabras de golpe y el filtro de arriba
    // lo deja pasar entero, asi que tras reequilibrar el vocab seguia enseñando
    // palabras que la historia ya no enseña. Se rehace con cuatro sustantivos
    // del vocab ACTUAL; la glosa sale de la definicion, que empieza por ella.
    const match = vivos.find((e) => e.type === "match_meaning");
    if (match) {
      const malas = (match.payload.pairs ?? []).filter((pr: any) =>
        !voc.some((v) => cubre(String(pr.word), String(v.word), String(v.surface ?? v.word))));
      if (malas.length) {
        const glosa = (d: string) => String(d).split(/[;.]/)[0].trim().replace(/^A /, "a ").replace(/^The /, "the ");
        const usadas = new Set(vivos.filter((e) => e !== match).flatMap((e) => String(e.word).split(",").map(norm)));
        const nuevos = voc.filter((v) => String(v.type) === "noun" && !usadas.has(norm(String(v.word))));
        // Si no hay cuatro sustantivos libres, se sustituyen SOLO los pares
        // malos y se conservan los buenos.
        const buenos = (match.payload.pairs ?? []).filter((pr: any) => !malas.includes(pr));
        // Y tampoco las que ya estan en los pares BUENOS del propio match: si
        // no, el mismo sustantivo salia dos veces en la misma tarjeta.
        const yaEnMatch = new Set(buenos.map((pr: any) => norm(String(pr.word))));
        const relleno = nuevos.filter((v) => !yaEnMatch.has(norm(String(v.word)))).slice(0, malas.length);
        if (relleno.length === malas.length) {
          const pares = [...buenos.map((pr: any) => ({ word: String(pr.word), gl: String(pr.answer) })),
                         ...relleno.map((v) => ({ word: String(v.word), gl: glosa(String(v.definition)) }))];
          const gl = pares.map((x) => x.gl);
          match.word = pares.map((x) => x.word).join(",");
          match.payload.pairs = pares.map((x) => ({ word: x.word, answer: x.gl, options: gl }));
        }
      }
    }
    if (!vivos.some((e) => e.type === "fill_blank")) {
      const rescate = exs.find((e) => e.type === "fill_blank");
      if (rescate) vivos.push(rescate);
    }
    quitados += exs.length - vivos.length;
    const cubiertas = vivos.flatMap((e) => String(e.word).split(","));
    for (const v of voc) {
      const w = String(v.word), sf = String(v.surface ?? v.word);
      if (cubiertas.some((t) => cubre(t, w, sf))) continue;
      const g = glosas.get(norm(w)) ?? AMANO[w];
      const cl = clausula(String(s.text), sf);
      if (!g) { sinGlosa.push(`${s.slug}:${w}`); continue; }
      if (!cl) { sinClausula.push(`${s.slug}:${w}`); continue; }
      const limpio = sinNombres(cl);
      const marcada = limpio.replace(new RegExp(`\\b${sf}\\b`, "iu"), (m) => `[[${m}]]`);
      vivos.push({ type: "meaning_in_context", word: w, sentence: marcada,
        payload: { prompt: "Choose the meaning in context.", answer: g.answer, options: g.options,
          audioClip: { storySlug: s.slug, storySource: "user", sentence: limpio, targetWord: sf, language: "german" } },
        featured: false });
      puestos++;
    }
    // Ninguna palabra objetivo dos veces en el mismo set: al rehacer el
    // `match_meaning` puede coincidir con un ejercicio suelto.
    const vistos = new Set<string>();
    const unicos = vivos.filter((e) => {
      const ws = String(e.word).split(",").map(norm);
      if (ws.some((w) => vistos.has(w)) && e.type !== "match_meaning") return false;
      ws.forEach((w) => vistos.add(w));
      return true;
    });
    vivos.length = 0; vivos.push(...unicos);
    // Exactamente 10 featured: se marcan los diez primeros.
    vivos.forEach((e, i) => { if (i < 10) delete e.featured; else e.featured = false; });
    sets.set(s.slug!, vivos);
  }
  console.log(`quitados ${quitados} · puestos ${puestos}`);
  if (sinGlosa.length) console.log(`sin glosa previa (${sinGlosa.length}): ${sinGlosa.join(", ")}`);
  if (sinClausula.length) console.log(`sin clausula (${sinClausula.length}): ${sinClausula.join(", ")}`);
  if (write) for (const [slug, exs] of sets)
    fs.writeFileSync(`scripts/_sets/${slug}.json`, JSON.stringify(exs, null, 1) + "\n");
  await p.$disconnect();
})();
