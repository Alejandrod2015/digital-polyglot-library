/** Tanda de revision de las glosas COPIADAS del bundle portuguese-traveler-brazil-b1
 *  (2026-09-07, chat de planificacion): las 455 copias leidas contra sus frases
 *  del B1; corrige las que traian el sentido del journey de ORIGEN y marca
 *  todas como leidas. Mismo molde que _a2Revisa.ts. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient(); const B = "portuguese-traveler-brazil-b1";

const FIX: Record<string, { g: string; t?: string }> = {
  capa: { g: "cover; capa dura, hardcover" },
  cola: { g: "sticks, glues on (colar)", t: "verb" },
  vai: { g: "goes; is going to (ir)" },
  cabe: { g: "fits (caber)" },
  mora: { g: "lives (morar)" },
  dura: { g: "lasts (durar); firm (letra dura)" },
  liga: { g: "phones, calls; switches on (ligar)" },
  leve: { g: "light; quem leve, someone to take it (levar)" },
  guia: { g: "guides (guiar); guide" },
  baixa: { g: "clearing of the record (dar baixa); low", t: "noun" },
  letra: { g: "handwriting; letra pequena, small print" },
  ficha: { g: "card, file (her route notes)" },
  "peça": { g: "asks (pedir: sem que ninguém peça); piece" },
  risco: { g: "crossed-out stroke, strike mark" },
  serve: { g: "serves the food (servir)" },
  sobra: { g: "is left over, to spare (sobrar)", t: "verb" },
  torce: { g: "twists (torcer: torce o pé)" },
  terra: { g: "dirt, earth (estrada de terra, dirt road)" },
  acordo: { g: "deal, agreement", t: "noun" },
  acerta: { g: "gets it right (acertar)" },
  fundo: { g: "the back (do fundo, at the back); bottom" },
  seca: { g: "dry (risada seca); dries (secar)" },
  encosta: { g: "hillside, slope", t: "noun" },
  passagem: { g: "passing through (de passagem); ticket" },
  quebra: { g: "a break, fracture; breaks (quebrar)", t: "noun" },
  cabine: { g: "booth" },
  polegar: { g: "thumb" },
  desligou: { g: "hung up (desligar)" },
  motorista: { g: "driver" },
  vizinho: { g: "the person next to you, neighbour" },
  senhora: { g: "polite you; madam" },
  confere: { g: "checks (conferir)" },
  acontece: { g: "happens (acontecer)" },
  perdeu: { g: "missed it (perder)" },
  ensina: { g: "teaches (ensinar)" },
  importa: { g: "matters (importar)" },
  baixo: { g: "low, softly; por baixo, underneath" },
  durante: { g: "during", t: "preposition" },
  parados: { g: "still, not moving (parado)", t: "adjective" },
  fechada: { g: "closed (fechar)", t: "adjective" },
};

(async () => {
  const rows = await p.tapGlossSet.findMany({ where: { bundle: B }, select: { slug: true, glosses: true } });
  let leidas = 0, corregidas = 0;
  for (const r of rows) {
    const g: any = { ...(r.glosses as any ?? {}) }; let toca = false;
    for (const [k, v] of Object.entries<any>(g)) {
      if (v?.rev !== false) continue;
      const fix = FIX[k.toLowerCase()];
      if (fix) { g[k] = { ...v, g: fix.g, ...(fix.t ? { t: fix.t } : {}), rev: true }; corregidas++; }
      else { g[k] = { ...v, rev: true }; leidas++; }
      toca = true;
    }
    if (toca) await p.tapGlossSet.update({ where: { bundle_slug: { bundle: B, slug: r.slug } }, data: { glosses: g } });
  }
  console.log(`leidas ${leidas} · corregidas ${corregidas}`);
})().finally(() => p.$disconnect());
