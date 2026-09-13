import { describe, expect, it } from "vitest";
import { validateGeneratedStory } from "@/lib/validateGeneratedStory";

async function sameRoot(language: string, a: string, b: string) {
  const r = await validateGeneratedStory(
    { title: "T", synopsis: "s", text: "x", vocab: [{ word: a, definition: "d" }, { word: b, definition: "d" }] } as never,
    { language, level: "a0" } as never
  );
  return r.checks.find((c) => c.id === "vocab-no-same-root")?.status;
}

// El idioma llega como codigo (saveStory, --lang DE) o como nombre de la base
// (cierraTema, "german"). Los dos caminos tienen que medir lo mismo.
const LANGS_DE = ["DE", "German", "german"];

describe("vocab-no-same-root", () => {
  it.each(LANGS_DE)("no agrupa por articulo + inicial (%s)", async (lang) => {
    for (const [a, b] of [
      ["der Platz", "der Park"],
      ["das Holz", "das Herz"],
      ["der Staub", "der Stapel"],
      ["die Seite", "die Schrift"],
    ]) {
      expect(await sameRoot(lang, a, b), `${a}+${b}`).toBe("pass");
    }
  });

  it.each(LANGS_DE)("gegen + gegenüber sigue fallando (%s)", async (lang) => {
    expect(await sameRoot(lang, "gegen", "gegenüber")).toBe("fail");
  });

  it("der Antrag + die Antragstellerin sigue fallando", async () => {
    expect(await sameRoot("german", "der Antrag", "die Antragstellerin")).toBe("fail");
  });

  it.each(["ES", "spanish"])("una raiz real en espanol falla aunque lleve articulo (%s)", async (lang) => {
    expect(await sameRoot(lang, "el trabajo", "trabajar")).toBe("fail");
    expect(await sameRoot(lang, "la plaza", "la playa")).toBe("pass");
  });

  it("frances con l' tambien", async () => {
    expect(await sameRoot("french", "l'habitation", "habiter")).toBe("fail");
    expect(await sameRoot("FR", "le marché", "la maison")).toBe("pass");
  });
});
