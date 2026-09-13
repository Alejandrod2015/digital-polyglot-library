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

describe("vocab-level-frequency FR A1/A2 (lista FLELex/Beacco)", () => {
  it("una plaza A2 que la fuente recoge pasa", async () => {
    // FLELex/Beacco: souvenir A1, blague A1, discours A2.
    expect(isFrenchA1A2("souvenir")).toBe(true);
    expect(isFrenchA1A2("le discours")).toBe(true);
    const c = await levelCheck([n("souvenir"), n("blague"), n("discours")]);
    expect(c?.status).toBe("pass");
  });

  it("palabras B2/C1 siguen fallando", async () => {
    // FLELex/Beacco: néanmoins B2, revendication B2; épistémologie no figura.
    const c = await levelCheck([n("néanmoins", { type: "adverb" }), n("revendication"), n("épistémologie")]);
    expect(c?.status).toBe("fail");
  });

  it("lo que la fuente pone en B1 no entra", () => {
    for (const w of ["vaisselle", "pardonner", "dispute"]) expect(isFrenchA1A2(w)).toBe(false);
  });

  it("un ancla cultural pasa como en ES; sin register vuelve a contar", async () => {
    // apéro es B2 en FLELex/Beacco.
    const exento = await levelCheck([n("apéro", { register: "cultural" }), n("verlan", { register: "cultural" }), n("clope", { register: "slang" })]);
    expect(exento?.status).toBe("pass");
    const sinRegister = await levelCheck([n("apéro"), n("verlan"), n("clope")]);
    expect(sinRegister?.status).toBe("fail");
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
