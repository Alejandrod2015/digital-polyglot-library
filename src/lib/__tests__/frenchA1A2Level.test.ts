import { describe, it, expect } from "vitest";
import { validateGeneratedStory } from "../validateGeneratedStory";
import { isFrenchA1A2 } from "../cefr/frenchA1A2";

type V = { word: string; definition: string; type: string; register?: string };

async function levelCheck(vocab: V[], language = "FR", level = "a2") {
  const text = "Léa rentre chez elle le soir. Elle pense à la journée.";
  const r = await validateGeneratedStory(
    { title: "Un soir", synopsis: "Une soirée tranquille.", arcType: "slice-of-life", text, vocab } as never,
    { language, level } as never,
  );
  return r.checks.find((c) => c.id === "vocab-level-frequency");
}

const n = (word: string, extra: Partial<V> = {}): V => ({
  word, definition: "def", type: "noun", ...extra,
});

// Las 28 palabras curadas a mano (ver cabecera de frenchA1A2.ts): vocabulario
// real del tema 1 del Friends FR/France A2 que no estaba en el bloque 1,
// cada una con nivel A1/A2 citado en FLELex/Beacco.
const CURATED = [
  "installer", "déranger", "blouson", "disque", "entier", "habitant", "attraper",
  "plutôt", "bizarre", "sommeil", "roman", "réveiller", "tellement", "insupportable",
  "taire", "critiquer", "avouer", "habitude", "endormir", "tranquillement", "tomber",
  "pourtant", "toucher", "douche", "surtout", "remarquer", "finalement", "plaire",
];

// Las 4 que el tema 1 también necesitaba pero se dejaron fuera por no tener
// respaldo A1/A2 en la referencia (ver cabecera): placard B1, ronfler C2,
// soupirer B2, célibataire (como nombre) B2.
const SIN_RESPALDO = ["placard", "ronfler", "soupirer", "célibataire"];

// Muestra de 50 palabras B1/B2 realistas usada para calibrar el intento
// anterior (Lexique + corte de frecuencia), retirado por no separar bien.
// Debe seguir fallando entera: nada de esto entró al volver al bloque 1 +
// el bloque curado de 28.
const B1B2_SAMPLE = [
  "néanmoins", "davantage", "revendiquer", "soupçonner", "épanouissement", "enjeu",
  "auparavant", "rapport", "regard", "pauvre", "état", "expérience", "esprit",
  "avenir", "professionnel", "politique", "assurer", "résultat", "actuel", "intérêt",
  "maladie", "victime", "empêcher", "mesure", "risque", "danger", "tendance",
  "comportement", "réduire", "majorité", "preuve", "constituer", "chercheur",
  "désormais", "réseau", "débat", "lutter", "souligner", "soutenir", "appliquer",
  "craindre", "capacité", "essentiel", "égalité", "favoriser", "démocratie",
  "réduction", "durable", "récemment", "envisager",
];

describe("vocab-level-frequency FR A1/A2 (bloque 1 + bloque curado del tema 1)", () => {
  it("las 28 palabras curadas del tema 1 pasan", () => {
    for (const w of CURATED) expect(isFrenchA1A2(w)).toBe(true);
  });

  it("las 28 curadas pasan también dentro del check completo", async () => {
    const c = await levelCheck(CURATED.map((w) => n(w)));
    expect(c?.status).toBe("pass");
  });

  it("las 4 palabras sin respaldo A1/A2 siguen sin pasar", () => {
    for (const w of SIN_RESPALDO) expect(isFrenchA1A2(w)).toBe(false);
  });

  it("la muestra B1/B2 de 50 no gana nada nuevo: ninguna de las 28 curadas la toca", () => {
    // 3 de las 50 (rapport, pauvre, maladie) YA pasaban antes de tocar nada
    // hoy: estaban en el bloque 1 original (818, sin cambios en este
    // encargo). No es fuga del bloque curado; es una característica
    // preexistente del bloque 1 que no corresponde arreglar aquí. Las
    // otras 47 siguen fallando, y ninguna de las 28 palabras que sí se
    // añadieron hoy coincide con la muestra (comprobado en la calibración,
    // commit b00810b2).
    const YA_EN_BLOQUE1 = new Set(["rapport", "pauvre", "maladie"]);
    for (const w of B1B2_SAMPLE) {
      const pasa = isFrenchA1A2(w);
      if (YA_EN_BLOQUE1.has(w)) expect(pasa).toBe(true);
      else expect(pasa).toBe(false);
    }
  });

  it("un ancla cultural pasa como en ES; sin register vuelve a contar", async () => {
    const exento = await levelCheck([
      n("crachin", { register: "cultural" }),
      n("tancarville", { register: "cultural" }),
    ]);
    expect(exento?.status).toBe("pass");
    const sinRegister = await levelCheck([
      n("crachin"),
      n("tancarville"),
    ]);
    expect(sinRegister?.status).not.toBe("pass");
  });

  it("normaliza œ/oe en los dos lados", () => {
    expect(isFrenchA1A2("œil")).toBe(true);
    expect(isFrenchA1A2("oeuf")).toBe(true);
  });

  it("DE A1/A2 no gana la exencion (el ancla cultural sigue contando)", async () => {
    const c = await levelCheck(
      [n("Weltanschauung", { register: "cultural" }), n("Zeitgeist", { register: "cultural" })],
      "DE",
    );
    // El fix es solo FR (scope declarado): en DE la palabra "cultural" no se
    // exime, así que sigue sumando a outOfLevel igual que antes del cambio.
    expect(c?.status).not.toBe("pass");
  });
});
