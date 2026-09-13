/**
 * Sonda gramatical de TRABAJO para el Friends FR B1 (no es un gate).
 * Cuenta por 100 oraciones: subjonctif present (por disparador + forma),
 * conditionnel present, discours indirect au passe, y marca formas B2
 * (conditionnel passe, subjonctif imparfait, passe simple frecuente).
 * Banda B1 aceptada por el plan: subj 1-4, cond 1-5, ind 1-3 por 100 oraciones.
 *
 *   npx tsx scripts/_frB1Gram.ts --control          prueba con frases de control
 *   npx tsx scripts/_frB1Gram.ts <data.json>        mide un fichero de tanda
 *   npx tsx scripts/_frB1Gram.ts --journey <id> [topic]
 */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import * as fs from "fs";

const W = "[\\p{L}'’-]";
const SUBJ_TRIG = "(?:il\\s+faut|faut|faudrait|veux|veut|voulait|voudrais|voudrait|voulez|préfère|préférais|préférerais|attends|attendait|bien|avant|pour|sans|condition|jusqu'à\\s+ce|peur|content|contente|dommage|pense\\s+pas|crois\\s+pas|pensait\\s+pas|croyait\\s+pas|étonnant|normal|possible|important|temps|aime\\s+pas)";
const SUBJ_FORMS = new Set(("sois soit soyons soyez soient aie aies ait ayons ayez aient fasse fasses fassions fassiez fassent puisse puisses puissions puissent aille ailles aillent sache saches sachent veuille veuilles veuillent vienne viennes viennent prenne prennes prennent dise dises disent parte partes partent dorme dormes dorment finisse finisses finissent comprenne comprennes comprennent revienne reviennes reviennent sorte sortes sortent lise lises écrive écrives mette mettes mettent boive boives voie voies voient croie crois doive doives doivent reçoive rende rendes attende attendes vende vendes perde perdes réponde répondes connaisse connaisses devienne deviennes tienne tiennes ouvre ouvres rembourse rembourses signe signes parle parles reste restes repose reposes arrête arrêtes rentre rentres appelle appelles occupe occupes change changes").split(/\s+/));
// Condicional: formas con raiz de futuro; se excluyen imperfectos de verbos en -rer/-rir y palabras que no son verbos.
const COND_EXCL = new Set("jamais mais vrais frais désormais portrait trait extrait attrait retrait tirait soupirait admirait désirait respirait attirait durait assurait mesurait jurait pleurait demeurait ignorait courait mourait séparait préparait entrait rentrait montrait adorait déclarait espérait exagérait serrait fermait tournait retournait espérais préparais entrais rentrais montrais adorais tirais admirais durais assurais pleurais ignorais courais mourais serrais fermais tournais ouvrait ouvrais souffrait offrait couvrait découvrait expirait inspirait".split(" "));
const CONDRX = new RegExp(`(?<!\\p{L})(${W}*?(?:er|ir|dr|ur|vr|rr|ser|aur|fer|ir|oudr|evr|audr|endr|ettr|ienr|err|oir|air|ur)(?:ais|ait|ions|iez|aient))(?!\\p{L})`, "giu");
const IND_VERB = "(?:dit|expliqué|raconté|répondu|annoncé|promis|avoué|prévenu|juré|écrit|répété|affirmé|assuré|demandé|prétendu|confié|rappelé|reconnu|admis|compris|appris|entendu|lu|juré|crié|murmuré|proposé|conseillé|avait\\s+dit)";
const INDRX = new RegExp(`(?<!\\p{L})(?:a|ai|as|avait|avaient|avais|ont|avons|avez|on\\s+a|m'a|t'a|lui\\s+a|leur\\s+a|m'avait|lui\\s+avait|nous\\s+a|l'a)\\s+(?:${W}+\\s+){0,2}?${IND_VERB}(?:\\s+(?:à|a)\\s+${W}+)?\\s+(?:qu['’]|que|si|s['’]|pourquoi|comment|où|combien|ce\\s+qu)`, "giu");
const INDRX2 = new RegExp(`(?<!\\p{L})(?:disait|racontait|expliquait|répétait|demandait|prétendait|affirmait|répondait|disaient|racontaient|répétaient)\\s+(?:à\\s+${W}+\\s+)?(?:qu['’]|que|si|s['’]|pourquoi|comment|où|ce\\s+qu)`, "giu");
const B2RX = new RegExp(`(?<!\\p{L})(?:aurais|aurait|aurions|auriez|auraient|serais|serait|serions|seriez|seraient)\\s+(?:pas\\s+|jamais\\s+|déjà\\s+|bien\\s+|dû|pu|voulu|été|eu|fait|dit|su|${W}+é|${W}+ée|${W}+és|${W}+i|${W}+u|${W}+is)(?!\\p{L})|(?<!\\p{L})(?:fût|eût|fît|dût|pût|fussent|eussent)(?!\\p{L})`, "giu");

export function mide(text: string) {
  const t = text.replace(/[“”«»]/g, " ").replace(/\s+/g, " ");
  const oraciones = t.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => /\p{L}/u.test(s));
  let subj = 0; const subjHits: string[] = [];
  const rxT = new RegExp(`(?<!\\p{L})${SUBJ_TRIG}\\s+(?:que|qu['’])\\s*((?:${W}+[\\s,;:]*){0,5})`, "giu");
  for (const m of t.matchAll(rxT)) {
    const toks = (m[1] ?? "").toLowerCase().split(/[\s.,!?;:]+/).filter(Boolean);
    if (toks.some((x) => SUBJ_FORMS.has(x.replace(/^(?:n|j|l|m|t|s)['’]/, "")))) { subj++; subjHits.push(m[0].trim()); }
  }
  const condHits = [...t.matchAll(CONDRX)].map((m) => m[1]).filter((w) => !COND_EXCL.has(w.toLowerCase()) && !/^(?:tirer|soir|voir|avoir|pouvoir|devoir|savoir|vouloir|valoir|recevoir|miroir|espoir|couloir|trottoir|comptoir|pleuvoir|falloir|bonsoir|mouchoir|tiroir|rasoir|noir|oir)$/i.test(w) && /(?:ais|ait|ions|iez|aient)$/i.test(w) && !/(?:issais|issait|issions|issiez|issaient)$/i.test(w));
  // condicional real: raiz terminada en r antes de la desinencia, y no imperfecto de verbo -rer conocido
  const b2Aux = new Set([...t.matchAll(B2RX)].map((m) => m[0].split(/\s+/)[0].toLowerCase()));
  // el auxiliar de un conditionnel passe no cuenta como condicional B1
  let restar = [...t.matchAll(B2RX)].length;
  const cond = condHits.filter((w) => /r(?:ais|ait|ions|iez|aient)$/i.test(w)).filter((w) => {
    if (restar > 0 && b2Aux.has(w.toLowerCase().replace(/^\p{L}['’]/u, ""))) { restar--; return false; } return true; });
  const ind = [...t.matchAll(INDRX)].map((m) => m[0]).concat([...t.matchAll(INDRX2)].map((m) => m[0]));
  const b2 = [...t.matchAll(B2RX)].map((m) => m[0]);
  const n = oraciones.length || 1;
  const por100 = (x: number) => Math.round((x * 100) / n);
  return { oraciones: n, subj, cond: cond.length, ind: ind.length, b2: b2.length, p100: { subj: por100(subj), cond: por100(cond.length), ind: por100(ind.length) }, hits: { subjHits, cond, ind, b2 } };
}

function control() {
  const casos: Array<[string, Partial<Record<"subj" | "cond" | "ind" | "b2", number>>]> = [
    ["Il faut que tu dormes. Il faut que tu sois là.", { subj: 2 }],
    ["Il faut que tu partes demain.", { subj: 1 }],
    ["Je veux qu'il vienne ce soir.", { subj: 1 }],
    ["Bien qu'elle soit fatiguée, elle travaille.", { subj: 1 }],
    ["Je pense que tu as raison.", { subj: 0 }],
    ["À ta place, je garderais ce poste.", { cond: 1 }],
    ["Si on ouvrait en septembre, on aurait la Braderie.", { cond: 1 }],
    ["Elle préparait le café et il tirait la porte.", { cond: 0 }],
    ["Il pleurait, il entrait, il montrait ses mains.", { cond: 0 }],
    ["Tu pourrais m'aider? Ce serait mieux.", { cond: 2 }],
    ["Florian a raconté qu'Aurélien avait fait une erreur.", { ind: 1 }],
    ["Elle lui a demandé s'il voulait du café.", { ind: 1 }],
    ["Il a dit à Élodie que le banc était libre.", { ind: 1 }],
    ["Elle dit que c'est bien.", { ind: 0 }],
    ["J'aurais dû te le dire.", { b2: 1, cond: 0 }],
    ["Il serait parti plus tôt.", { b2: 1, cond: 0 }], ["Il a pensé qu'elle aurait le temps, et il serait heureux.", { cond: 2, b2: 0 }],
    ["Romain voudrait l'entendre de sa bouche.", { cond: 1 }],
    ["Il n'a jamais dit merci, mais il est vrai et frais.", { cond: 0, ind: 0 }],
  ];
  let ok = 0;
  for (const [f, esp] of casos) {
    const r = mide(f); const got: Record<string, number> = { subj: r.subj, cond: r.cond, ind: r.ind, b2: r.b2 };
    const fallo = Object.entries(esp).filter(([k, v]) => got[k] !== v);
    // conditionnel passe cuenta aparte: "aurais dû" contiene -rais pero no se quiere como B1
    console.log(fallo.length ? "FALLA" : "ok   ", f, JSON.stringify(got), fallo.length ? `esperado ${JSON.stringify(esp)}` : "");
    if (!fallo.length) ok++;
  }
  console.log(`${ok}/${casos.length} controles`);
}

async function main() {
  const a = process.argv.slice(2);
  if (a[0] === "--control") return control();
  let stories: Array<{ topic?: string; slotIndex?: number; title?: string; text: string }> = [];
  if (a[0] === "--journey") {
    const { PrismaClient } = await import("../src/generated/prisma"); const p = new PrismaClient();
    stories = (await p.journeyStory.findMany({ where: { journeyId: a[1], ...(a[2] ? { topic: a[2] } : {}), text: { not: null } }, orderBy: [{ topic: "asc" }, { slotIndex: "asc" }], select: { topic: true, slotIndex: true, title: true, text: true } })) as any;
    await p.$disconnect();
  } else stories = JSON.parse(fs.readFileSync(a[0], "utf8"));
  let tot = { o: 0, s: 0, c: 0, i: 0, b: 0 };
  for (const s of stories) {
    const r = mide(s.text);
    tot.o += r.oraciones; tot.s += r.subj; tot.c += r.cond; tot.i += r.ind; tot.b += r.b2;
    console.log(`${s.topic}#${s.slotIndex} ${s.title}: ${r.oraciones} oraciones · subj ${r.subj} · cond ${r.cond} · ind ${r.ind} · B2 ${r.b2}`);
    console.log(`   subj: ${r.hits.subjHits.join(" | ")}\n   cond: ${r.hits.cond.join(", ")}\n   ind: ${r.hits.ind.join(" | ")}${r.b2 ? `\n   B2: ${r.hits.b2.join(" | ")}` : ""}`);
  }
  const p = (x: number) => Math.round((x * 100) / (tot.o || 1));
  const enBanda = (v: number, lo: number, hi: number) => (v >= lo && v <= hi ? "en banda" : "FUERA");
  console.log(`TOTAL ${tot.o} oraciones · subj ${tot.s} (${p(tot.s)}/100, 1-4 ${enBanda(p(tot.s), 1, 4)}) · cond ${tot.c} (${p(tot.c)}/100, 1-5 ${enBanda(p(tot.c), 1, 5)}) · ind ${tot.i} (${p(tot.i)}/100, 1-3 ${enBanda(p(tot.i), 1, 3)}) · B2 ${tot.b}`);
}
main();
