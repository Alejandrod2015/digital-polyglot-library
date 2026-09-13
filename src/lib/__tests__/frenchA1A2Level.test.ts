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

describe("vocab-level-frequency FR A1/A2 (lista Lexique383, corte de frecuencia)", () => {
  it("una plaza A2 que la fuente recoge pasa", async () => {
    // Lexique383: souvenir rank 321, blague rank 1423, discours rank 1447.
    // Muy por dentro del corte de 6000.
    expect(isFrenchA1A2("souvenir")).toBe(true);
    expect(isFrenchA1A2("le discours")).toBe(true);
    const c = await levelCheck([n("souvenir"), n("blague"), n("discours")]);
    expect(c?.status).toBe("pass");
  });

  it("palabras claramente B2/C1 siguen fallando", async () => {
    // Lexique383: revendication rank 9454, dialectique rank 13650,
    // épistémologie rank 35947. Las tres muy por fuera del corte de 6000
    // (dialectique, la más frecuente de la muestra académica usada para
    // calibrar el corte, queda a más del doble del corte).
    const c = await levelCheck([n("revendication"), n("dialectique", { type: "adjective" }), n("épistémologie")]);
    expect(c?.status).toBe("fail");
  });

  it("limite conocido: una palabra B1 frecuente puede colarse (tradeoff documentado)", () => {
    // A diferencia de FLELex (nivel MCER experto por palabra), Lexique383 es
    // solo frecuencia. "vaisselle", "pardonner" y "dispute" son B1 en
    // FLELex/Beacco pero caen dentro del corte de 6000 por ser frecuentes
    // (ranks 2896, 792, 3477). No es un bug: el corte separa "claramente
    // básico" de "claramente avanzado", no A2 de B1 con precisión de
    // experto (ver el LÍMITE reconocido en la cabecera de frenchA1A2.ts).
    for (const w of ["vaisselle", "pardonner", "dispute"]) expect(isFrenchA1A2(w)).toBe(true);
  });

  it("un ancla cultural pasa como en ES; sin register vuelve a contar", async () => {
    // "verlan" (jerga real) y "dialectique" quedan fuera del corte de
    // frecuencia (ranks 26819 y 13650); sirven para probar que el register
    // exime el eje de frecuencia sin depender de si la palabra es rara.
    const exento = await levelCheck([
      n("verlan", { register: "slang" }),
      n("dialectique", { type: "adjective", register: "cultural" }),
    ]);
    expect(exento?.status).toBe("pass");
    const sinRegister = await levelCheck([
      n("verlan"),
      n("dialectique", { type: "adjective" }),
    ]);
    // 2 fuera de nivel = warn (el umbral de 0/1-2/3+ es el mismo que en
    // DE/IT/PT); lo relevante es que sin register NO pasa.
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
