import { describe, it, expect, vi } from "vitest";
import { transcribeWithRetries, referenceWordsFor, isGapStillMissing, whisperLangFor, numberLangFor } from "../coverageWhisperCheck";
import { checkCoverage, norm, type Gap } from "../coverageCheckLib";

// Datos reales: master "rendez-vous-sous-la-bourse" (Friends FR B1, 68053ms
// por ffprobe). whisper-cli con -ml 1 (y con cualquier otra combinacion de
// flags probada) para en seco a los 59520ms, exit 0, sin aviso, perdiendo
// "J'aimerais te revoir. Samedi soir, ça te dit?..." hasta el final. Un
// segundo pase con -ot 59520 sobre el MISMO wav transcribe el resto perfecto.
const PASS_0 = [
  { text: "gardé", start: 57.36, end: 57.85 },
  { text: "pour", start: 57.85, end: 58.13 },
  { text: "lui", start: 58.18, end: 58.18 },
  { text: "la", start: 58.42, end: 58.58 },
  { text: "vérité.", start: 58.58, end: 59.52 },
];
const PASS_1 = [
  { text: "J'aimerais", start: 59.52, end: 60.2 },
  { text: "te", start: 60.2, end: 60.35 },
  { text: "revoir,", start: 60.35, end: 60.93 },
  { text: "samedi", start: 60.93, end: 61.17 },
  { text: "soir,", start: 61.17, end: 61.94 },
  { text: "lui", start: 62.25, end: 62.39 },
  { text: "a", start: 62.39, end: 62.45 },
  { text: "proposé", start: 62.45, end: 62.79 },
  { text: "Marion.", start: 62.79, end: 63.66 },
  { text: "Aurélien", start: 63.66, end: 63.95 },
  { text: "a", start: 63.95, end: 64.07 },
  { text: "dit", start: 64.07, end: 64.25 },
  { text: "oui", start: 64.25, end: 64.41 },
  { text: "trop", start: 64.41, end: 64.69 },
  { text: "vite,", start: 64.69, end: 65.0 },
  { text: "le", start: 65.0, end: 65.27 },
  { text: "coeur", start: 65.27, end: 65.53 },
  { text: "léger", start: 65.53, end: 66.11 },
  { text: "et", start: 66.11, end: 66.21 },
  { text: "un", start: 66.21, end: 66.34 },
  { text: "mensonge", start: 66.34, end: 66.88 },
  { text: "sur", start: 66.88, end: 67.08 },
  { text: "la", start: 67.08, end: 67.27 },
  { text: "conscience.", start: 67.27, end: 68.05 },
];
const DURATION_MS = 68053;

describe("transcribeWithRetries", () => {
  it("reintenta con -ot cuando whisper para antes del final real y concatena sin duplicar", async () => {
    const runPass = vi.fn(async (offsetMs: number) => (offsetMs === 0 ? PASS_0 : PASS_1));
    const words = await transcribeWithRetries(runPass, DURATION_MS);

    expect(runPass).toHaveBeenCalledTimes(2);
    expect(runPass).toHaveBeenNthCalledWith(2, 59520);
    expect(words.map((w) => w.text)).toEqual([...PASS_0, ...PASS_1].map((w) => w.text));
    expect(words[words.length - 1].end).toBe(68.05);
  });

  it("no reintenta si la primera pasada ya llega cerca del final real", async () => {
    const runPass = vi.fn(async () => [{ text: "fin.", start: 67.9, end: 68.0 }]);
    const words = await transcribeWithRetries(runPass, DURATION_MS);

    expect(runPass).toHaveBeenCalledTimes(1);
    expect(words).toHaveLength(1);
  });

  it("para y avisa (sin bucle infinito) si un reintento no avanza nada", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const runPass = vi.fn(async (offsetMs: number) => (offsetMs === 0 ? PASS_0 : []));
    const words = await transcribeWithRetries(runPass, DURATION_MS);

    expect(runPass).toHaveBeenCalledTimes(2);
    expect(words).toEqual(PASS_0);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("sin avanzar"));
    warn.mockRestore();
  });

  it("agota los reintentos y avisa si la transcripcion sigue corta", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    let calls = 0;
    const runPass = vi.fn(async (offsetMs: number) => {
      calls++;
      // cada pase avanza un poco pero nunca llega a los 68s reales
      return [{ text: `palabra${calls}`, start: offsetMs / 1000, end: offsetMs / 1000 + 2 }];
    });
    const words = await transcribeWithRetries(runPass, DURATION_MS, { maxPasses: 3 });

    expect(runPass).toHaveBeenCalledTimes(3);
    expect(words).toHaveLength(3);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("tras 3 intentos"));
    warn.mockRestore();
  });
});

const w = (s: string) => s.split(/\s+/).map(norm).filter(Boolean);

// Fixture real: un-segreto-tra-noi-due (Friends IT A0, Genova). El titulo se
// dice UNA vez como fragmento [0] del master y el CUERPO lo repite una vez
// mas, a proposito, como eco narrativo en el dialogo final. El master real
// (whisper-small, 2026-09-16) oye el titulo dos veces en total. La misma
// clase de falso positivo (fase, no arreglada, "descartada a mano") ya se
// habia visto antes en el Friends FR A2 ("La sauce ne tient pas", "Il y a
// douze ans").
const TITLE = "Un segreto tra noi due";
const TEXT =
  "Alice sale al quinto piano in ascensore. Nell'ascensore Alice incontra Federica. " +
  "L'ascensore e stretto. Tra il terzo e il quarto piano la luce si spegne e l'ascensore si ferma. " +
  "E tutto buio. Alice respira forte e conta fino a dieci. Tranquilla. Io sono un'architetta. " +
  "L'ascensore e bloccato, ma il palazzo e forte, dice Federica. Lei accende la torcia del telefono. " +
  "Federica vede spesso Alice con Matteo. Tu sei Alice, vero? Matteo e il tuo fidanzato? chiede Federica. " +
  "Alice alza gli occhi verso la piccola luce e trema. No. Ma io amo Matteo. Lui non lo sa, risponde Alice. " +
  "E la prima volta. Alice parla ad alta voce, sincera. " +
  "Federica ascolta e non ride. Lei spegne la torcia. Allora questo e un segreto tra noi due. " +
  "Tu lo dici a lui un giorno. Oppure mai, sussurra Federica. La luce torna e l'ascensore sale. " +
  "Alice esce al quinto piano con le guance calde.";

// Lo que dice el master de verdad: el titulo como fragmento [0], despues el
// cuerpo (que ya contiene su propio eco del titulo).
const HEARD = w(`${TITLE}. ${TEXT}`);

describe("referenceWordsFor / eco del titulo en el cuerpo", () => {
  it("BUG (comportamiento viejo): comparar solo contra el cuerpo marca un duplicado falso", () => {
    // Antes del fix, checkMasterCoverage tokenizaba solo `referenceText`
    // (el cuerpo), nunca el titulo. Reproducido aqui sin red: el titulo se
    // oye 2 veces (fragmento [0] + eco en el cuerpo) pero el texto de
    // referencia solo lo tiene 1 vez (el eco), asi que 2 > 1 dispara
    // findDuplicates.
    const textWordsSoloCuerpo = w(TEXT);
    const res = checkCoverage(textWordsSoloCuerpo, HEARD);
    expect(res.ok).toBe(false);
    expect(res.duplicates.length).toBeGreaterThan(0);
  });

  it("FIX: referenceWordsFor(title, text) cuenta las 2 veces y no marca duplicado", () => {
    const textWordsConTitulo = referenceWordsFor(TITLE, TEXT).map(norm);
    const res = checkCoverage(textWordsConTitulo, HEARD);
    expect(res.ok).toBe(true);
    expect(res.duplicates).toEqual([]);
    expect(res.gaps).toEqual([]);
  });

  it("sin titulo (parametro omitido), referenceWordsFor no cambia el comportamiento de siempre", () => {
    expect(referenceWordsFor(undefined, "Bonjour le monde")).toEqual(w("Bonjour le monde"));
  });
});

// Fixture real: domenica-senza-terrazza (Friends IT A0). El pase completo
// (whisper-small sobre un master de 79s) perdio "non sa del patto per lui e
// un vecchio scherzo" (10 palabras); aislando y re-transcribiendo ESE
// fragmento (43,78-62,82s) por separado, whisper lo oye completo y correcto.
// Confirmado a mano dos veces en el mismo journey (aqui y en
// solo-per-una-foto) antes de escribir este fix.
describe("isGapStillMissing (candado de falsos positivos, 2026-09-16)", () => {
  const gap: Gap = {
    textWords: w("non sa del patto per lui e un vecchio scherzo"),
    startIdx: 100,
    endIdx: 110,
    anchorBeforeIdx: 42,
    anchorAfterIdx: 55,
  };

  it("FALSO POSITIVO: las palabras SI aparecen al re-escuchar solo la ventana -> el hueco se descarta", () => {
    // Lo que de verdad transcribe whisper al aislar el fragmento 3 completo
    // (confirmado a mano, 2026-09-16): la frase entera esta ahi.
    const rehardWords = w(
      "Valentina appoggia il pane e si siede accanto al davanzale Alice lui non capisce " +
      "non sa del patto per lui e un vecchio scherzo dice lei Alice ascolta sospira e si morde il labbro Valentina ha ragione"
    );
    expect(isGapStillMissing(gap, rehardWords, "it")).toBe(false);
  });

  it("HUECO REAL: las palabras siguen sin aparecer ni en la ventana re-escuchada -> el hueco se mantiene", () => {
    // Mismo fragmento pero de verdad le falta el tramo (empalme roto, por
    // ejemplo): el candado no puede ablandarse hasta el punto de nunca
    // marcar nada.
    const rehardWords = w(
      "Valentina appoggia il pane e si siede accanto al davanzale Alice lui non capisce " +
      "dice lei Alice ascolta sospira e si morde il labbro Valentina ha ragione"
    );
    expect(isGapStillMissing(gap, rehardWords, "it")).toBe(true);
  });
});

describe("idioma del journey", () => {
  it("el espanol transcribe con -l es y usa la tabla de numeros espanola", () => {
    expect(whisperLangFor("spanish")).toBe("es");
    expect(numberLangFor("spanish")).toBe("es");
  });

  it("aleman y frances no cambian", () => {
    expect(whisperLangFor("german")).toBe("de");
    expect(numberLangFor("german")).toBe("de");
    expect(whisperLangFor("french")).toBe("fr");
    expect(numberLangFor(null)).toBe("fr");
  });
});
