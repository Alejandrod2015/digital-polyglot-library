import { PrismaClient } from "../src/generated/prisma";
import { castOf, castLegacy, HABLA_POR_IDIOMA } from "./_castExtract";
import NAMES from "./_castNames.json";
const p = new PrismaClient();
const LANG: Record<string, string> = { german: "DE", spanish: "ES", portuguese: "PT", french: "FR", italian: "IT", korean: "KO", polish: "PL", arabic: "AR" };
const ART_RE = (lang: string) => {
  const SOLO_PT = lang === "ES" || lang === "FR" || lang === "IT" ? "" : "|o|a|os|as|um|uma";
  return new RegExp(`(?<!\\p{L})(der|die|das|den|dem|des|ein|eine|einen|einem|einer|zum|zur|im|am|beim|vom|le|la|les|un|une|du|el|los|las|il|lo|gli${SOLO_PT})\\s+$`, "iu");
};
const MID = /[\p{Ll}],?\s+$/u;

async function main() {
  const js = await p.journey.findMany({ where: { status: { in: ["active", "draft"] } },
    orderBy: [{ language: "asc" }, { levels: "asc" }],
    select: { id: true, name: true, language: true, variant: true, levels: true, status: true,
      stories: { orderBy: [{ topic: "asc" }, { slotIndex: "asc" }], select: { slug: true, text: true, topic: true } } } });
  const rows: any[] = [];
  for (const j of js) {
    const lang = LANG[j.language] ?? "?";
    const names: string[] = (NAMES as any)[lang] ?? [];
    const stories = j.stories.filter((s) => (s.text ?? "").length > 200)
      .map((s) => ({ slug: s.slug ?? "", title: "", text: s.text ?? "", language: j.language, level: j.levels[0] ?? "", topic: s.topic }));
    if (stories.length < 3 || !names.length) continue;
    const detected = castOf(stories as any, lang);
    const legacy = new Set(castLegacy(stories as any, lang));
    const HABLA = HABLA_POR_IDIOMA[lang] ?? HABLA_POR_IDIOMA.DE;
    const ART = ART_RE(lang);

    const presencia = new Map<string, number>();
    const hablaSt = new Map<string, number>();     // historias con el nombre pegado a verbo de habla
    const midSt = new Map<string, number>();       // historias donde pasa el filtro MID de castLegacy
    const conArt = new Set<string>();
    const nombresEnTexto = new Set<string>();
    for (const s of stories) {
      const re = new RegExp(`(?<!\\p{L})(${names.join("|")})(?!\\p{L})`, "gu");
      const aqui = new Set<string>(); for (const m of s.text.matchAll(re)) aqui.add(m[1]);
      for (const n of aqui) { presencia.set(n, (presencia.get(n) ?? 0) + 1); nombresEnTexto.add(n); }
      for (const r of [new RegExp(`(?:${HABLA})\\s+([\\p{Lu}][\\p{Ll}]+)`, "gu"), new RegExp(`([\\p{Lu}][\\p{Ll}]+)\\s+(?:${HABLA})`, "gu")]) {
        const vis = new Set<string>(); for (const m of s.text.matchAll(r)) vis.add(m[1]);
        for (const n of vis) if (names.includes(n)) hablaSt.set(n, (hablaSt.get(n) ?? 0) + 1);
      }
      const vistos = new Set<string>();
      for (const m of s.text.matchAll(/\p{Lu}\p{Ll}{2,}/gu)) {
        const i = m.index ?? 0; const antes = s.text.slice(Math.max(0, i - 14), i);
        if (ART.test(antes)) { conArt.add(m[0]); continue; }
        if (MID.test(antes)) vistos.add(m[0]);
      }
      for (const w of vistos) midSt.set(w, (midSt.get(w) ?? 0) + 1);
    }
    // habla por historia: el map de arriba suma por regex; recalcular como union
    const hablaUnion = new Map<string, Set<string>>();
    for (const s of stories) for (const r of [new RegExp(`(?:${HABLA})\\s+([\\p{Lu}][\\p{Ll}]+)`, "gu"), new RegExp(`([\\p{Lu}][\\p{Ll}]+)\\s+(?:${HABLA})`, "gu")])
      for (const m of s.text.matchAll(r)) { if (!hablaUnion.has(m[1])) hablaUnion.set(m[1], new Set()); hablaUnion.get(m[1])!.add(s.slug); }

    const real = [...nombresEnTexto].filter((n) => (presencia.get(n) ?? 0) >= 3).sort((a, b) => (presencia.get(b)! - presencia.get(a)!));
    const faltan = real.filter((n) => !detected.includes(n));
    const sobran = detected.filter((n) => !names.includes(n));
    const menores = detected.filter((n) => names.includes(n) && !real.includes(n));
    // etiqueta de dialogo: "Nombre:" al empezar un parrafo/linea
    const etiqueta = new Map<string, number>();
    for (const s of stories) for (const m of s.text.matchAll(/(?:^|\n)\s*(\p{Lu}\p{Ll}+)\s*:/gu))
      etiqueta.set(m[1], (etiqueta.get(m[1]) ?? 0) + 1);
    const HABLA_EXT: Record<string, string> = {
      DE: "meint|erklärt|wiederholt|murmelt|erwidert|seufzt|brummt|widerspricht|grüßt|bestätigt|" +
          "sagte|fragte|antwortete|rief|erzählte|erklärte|meinte|flüsterte|sagen|fragen|antworten",
      ES: "murmura|susurra|comenta|afirma|propone|sugiere|advierte|aclara|recuerda|opina|bromea|saluda|confirma|añade|anade|interrumpe|responde|asegura|admite|protesta|exclama|murmuro|murmuró|comento|comentó|propuso|sugirio|sugirió|advirtio|advirtió|aclaro|aclaró|recordo|recordó|añadio|añadió|aseguro|aseguró|admitio|admitió",
      PT: "murmura|sussurra|comenta|afirma|propoe|propõe|sugere|avisa|acrescenta|confirma|cumprimenta|insiste|reclama|murmurou|comentou|afirmou|sugeriu|acrescentou|confirmou|insistiu",
      FR: "murmure|chuchote|commente|affirme|propose|suggère|prévient|précise|rappelle|ajoute|confirme|salue|insiste|réplique|lance",
      IT: "mormora|commenta|afferma|suggerisce|avverte|precisa|ricorda|insiste|replica|saluta|borbotta|esclama",
    };
    const EXT = new RegExp(`(?:(?:${HABLA_EXT[lang] ?? ""})\\s+([\\p{Lu}][\\p{Ll}]+)|([\\p{Lu}][\\p{Ll}]+)\\s+(?:${HABLA_EXT[lang] ?? ""}))`, "gu");
    const extSt = new Map<string, Set<string>>();
    for (const s of stories) for (const m of s.text.matchAll(EXT)) {
      const w = m[1] ?? m[2]; if (!extSt.has(w)) extSt.set(w, new Set()); extSt.get(w)!.add(s.slug);
    }
    const diag = faltan.map((n) => {
      const h = hablaUnion.get(n)?.size ?? 0;
      const inLeg = legacy.has(n);
      const et = etiqueta.get(n) ?? 0;
      const ex = extSt.get(n)?.size ?? 0;
      const causa = h >= 2 && !inLeg ? (conArt.has(n) ? "D. legacy: articulo delante" : `E. legacy: solo inicio de frase (MID en ${midSt.get(n) ?? 0} hist)`)
        : et >= 2 ? "A. formato dialogo (etiqueta Nombre:)"
        : h + ex >= 2 && ex > 0 ? "B. verbo de habla fuera de la lista"
        : h === 1 ? "C. umbral: habla en 1 sola historia"
        : "F. solo sujeto de verbo de accion (nunca junto a verbo de habla)";
      return { n, st: presencia.get(n), habla: h, ext: ex, etiq: et, mid: midSt.get(n) ?? 0, art: conArt.has(n), legacy: inLeg, causa };
    });
    rows.push({ id: j.id, lang, j: `${j.name} ${j.language}/${j.variant} ${j.levels.join("/")} ${j.status}`,
      n: stories.length, hero: detected[0] ?? null, heroReal: real[0] ?? null,
      detected, real: real.map((n) => `${n}:${presencia.get(n)}`), faltan: faltan.length, sobran, menores, diag });
  }
  console.log(JSON.stringify(rows, null, 1));
}
main().finally(() => p.$disconnect());
