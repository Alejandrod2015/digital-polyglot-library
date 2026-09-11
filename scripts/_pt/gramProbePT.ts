/**
 * Sonda de gramatica de NIVEL para portugues de Brasil (la de scripts/_gramProbe.ts
 * solo tiene regex de espanol). Mide, por cada 100 oraciones y por tema, los tres
 * marcadores que separan un B1 de un A2 (banda B1 del proyecto, aceptada el
 * 2026-09-10 para espanol y aplicada aqui por equivalencia):
 *
 *   subjuntivo imperfecto (imperfeito do subjuntivo)  B1: 1-4
 *   condicional (futuro do preterito)                 B1: 1-5
 *   estilo indirecto (disse que, perguntou se...)      B1: 1-3
 *
 * y, como contexto, cuantos preteritos lleva la narracion (un B1 narra en pasado;
 * sin pasado no hay correlacion de tiempos ni estilo indirecto).
 *
 * ANTES de medir corre sus propios CONTROLES: un texto con marcadores conocidos
 * y otro sin ninguno. Si un control no da lo esperado, SALE CON ERROR y no mide:
 * una sonda que no ve lo que tiene delante no puede decidir un nivel (el
 * 2026-09-10 `_gramProbe` no veia ningun preterito en -o por un `\b` sin la
 * bandera `u`; aqui "disse" daba falso subjuntivo hasta excluirlo).
 *
 * Uso:
 *   npx tsx scripts/_pt/gramProbePT.ts --journey <id>          (todo el journey)
 *   npx tsx scripts/_pt/gramProbePT.ts --json <historias.json> (fixture o borrador)
 * Las historias necesitan { topic, slotIndex?, text }.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import * as fs from "fs";

// Terminaciones del imperfeito do subjuntivo: falasse, vendesse, partisse,
// tivesse, fosse, estivesse, fizesse... (y sus plurales -ssemos, -ssem).
// -osse entra por fosse/fossem (ser/ir), la forma mas frecuente; tosse y posse no.
const SUBJ = /(?<![\p{L}])[\p{L}]+(?:ásse|êsse|ísse|asse|esse|isse|osse)(?:s|mos|m)?(?![\p{L}])/giu;
// Palabras que terminan igual y NO son subjuntivo. "disse" es preterito de dizer.
const NO_SUBJ = new Set(["esse", "essa", "isso", "isse", "nesse", "desse", "classe", "interesse", "expresse", "disse", "impasse", "passe", "compasse", "endereço", "tosse", "posse", "grosse", "fosso"]);
// Futuro do preterito: falaria, venderia, partiria, faria, diria, traria, seria, iria...
// La raiz puede ser corta (s-eria, f-aria, d-iria): antes se exigian dos letras y
// estas, que son las mas frecuentes, no se contaban.
const COND = /(?<![\p{L}])[\p{L}]*(?:aria|eria|iria|ariam|eriam|iriam|aríamos|eríamos|iríamos)(?![\p{L}])/giu;
const NO_COND = new Set(["maria", "padaria", "livraria", "secretaria", "lavanderia", "portaria", "galeria", "maioria", "categoria", "bateria", "loteria", "peixaria", "papelaria", "mercearia", "cafeteria", "sorveteria", "joalheria", "engenharia", "cervejaria", "varia", "feria", "série", "história", "vitória", "memória", "glória", "cadeira", "geladeira", "carteira",
  // imperfeito de verbos con raiz en -er/-ir: quer-ia, prefer-ia (el condicional es quereria, preferiria)
  "queria", "queriam", "preferia", "preferiam", "sugeria", "conferia", "transferia", "referia", "requeria"]);
// Estilo indirecto: verbo de lengua en PASADO + que/se. "diz que" no cuenta.
const IND = /(?<![\p{L}])(?:disse|dissera|dizia|contou|contava|perguntou|perguntava|explicou|avisou|pediu|respondeu|garantiu|prometeu|comentou|lembrou)\s+(?:que|se)(?![\p{L}])/giu;
// Preterito perfeito (3a sg/pl y 1a sg) e imperfeito, solo como contexto.
const PRET = /(?<![\p{L}])[\p{L}]+(?:ou|eu|iu|aram|eram|iram|ava|avam|ia|iam)(?![\p{L}])/giu;
const NO_PRET = new Set(["eu", "seu", "meu", "teu", "ou", "sou", "vou", "dou", "estou", "céu", "museu", "deu", "leu", "pneu", "dia", "tia", "via", "guia", "praia", "meia", "cheia", "ideia", "areia", "saia", "maia", "baía", "lia", "mia", "pia", "sia"]);

type Cuenta = { subj: string[]; cond: string[]; ind: string[]; pret: string[]; oraciones: number };
const hits = (re: RegExp, t: string, no?: Set<string>) =>
  (t.match(re) ?? []).filter((m) => !no || !no.has(m.toLowerCase()));
export function mide(t: string): Cuenta {
  const plano = t.replace(/\n+/g, " ");
  return {
    subj: hits(SUBJ, plano, NO_SUBJ),
    cond: hits(COND, plano, NO_COND),
    ind: hits(IND, plano),
    pret: hits(PRET, plano, NO_PRET).filter((m) => !NO_COND.has(m.toLowerCase()) && !/(?:aria|eria|iria|ariam|eriam|iriam)$/i.test(m)),
    oraciones: plano.split(/(?<=[.!?”])\s+/).filter((o) => o.trim().length > 1).length,
  };
}

function controles(): void {
  const si = mide("Se ela tivesse tempo, falaria com ele. Ontem ela disse que voltaria. Ele perguntou se ela vinha. Pediu que fizessem silêncio. Parecia que fosse tarde. Seria bom e ele faria tudo.");
  const no = mide("Ele disse: vou agora. A padaria da Maria fecha às seis. Essa ideia é boa e a praia está cheia. Ele tem tosse e posse da casa. Ela queria café e preferia chá. A Maria é séria.");
  const ok = si.subj.length === 3 && si.cond.length === 4 && si.ind.length === 3
    && no.subj.length === 0 && no.cond.length === 0 && no.ind.length === 0;
  console.log(`controles: positivo subj ${si.subj.length}/3 cond ${si.cond.length}/4 ind ${si.ind.length}/3 · negativo ${no.subj.length}/${no.cond.length}/${no.ind.length} (esperado 0/0/0) -> ${ok ? "OK" : "FALLAN"}`);
  if (!ok) {
    console.error("La sonda no ve lo que tiene delante; no mide nada.", JSON.stringify({ si, no }));
    process.exit(1);
  }
}

const BANDA = { subj: [1, 4], cond: [1, 5], ind: [1, 3] } as const;
const tasa = (n: number, o: number) => (o ? (100 * n) / o : 0);
const enBanda = (k: keyof typeof BANDA, v: number) => Math.round(v) >= BANDA[k][0] && Math.round(v) <= BANDA[k][1];

async function carga(): Promise<Array<{ topic: string; slotIndex?: number; slug?: string; text: string }>> {
  const a = process.argv;
  const json = a[a.indexOf("--json") + 1];
  if (a.includes("--json")) return JSON.parse(fs.readFileSync(json, "utf8"));
  const id = a[a.indexOf("--journey") + 1];
  const { PrismaClient } = await import("../../src/generated/prisma");
  const p = new PrismaClient();
  try {
    const j = await p.journey.findUnique({ where: { id }, select: { topics: true } });
    const rows = await p.journeyStory.findMany({ where: { journeyId: id, NOT: { text: null } }, select: { topic: true, slotIndex: true, slug: true, text: true } });
    const orden = j?.topics ?? [];
    return rows.map((r) => ({ ...r, text: r.text!, slug: r.slug ?? "" }))
      .sort((x, y) => orden.indexOf(x.topic) - orden.indexOf(y.topic) || x.slotIndex - y.slotIndex);
  } finally { await p.$disconnect(); }
}

(async () => {
  controles();
  const hs = await carga();
  const temas = [...new Set(hs.map((h) => h.topic))];
  for (const t of temas) {
    const c = mide(hs.filter((h) => h.topic === t).map((h) => h.text).join("\n"));
    const s = tasa(c.subj.length, c.oraciones), co = tasa(c.cond.length, c.oraciones), i = tasa(c.ind.length, c.oraciones);
    const ok = enBanda("subj", s) && enBanda("cond", co) && enBanda("ind", i);
    console.log(`${t.padEnd(22)} ${c.oraciones} or. · subjImp ${s.toFixed(1)} · cond ${co.toFixed(1)} · indirecto ${i.toFixed(1)} · preteritos ${c.pret.length} -> ${ok ? "EN BANDA B1" : "fuera de banda"}`);
    console.log(`${"".padEnd(22)} subj: ${c.subj.join(", ") || "-"} | cond: ${c.cond.join(", ") || "-"} | ind: ${c.ind.join(", ") || "-"}`);
  }
  console.log("banda B1 por 100 oraciones: subjImp 1-4 · cond 1-5 · indirecto 1-3 (Math.round)");
})();
