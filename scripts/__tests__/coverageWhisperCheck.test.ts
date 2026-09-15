import { describe, it, expect, vi } from "vitest";
import { transcribeWithRetries } from "../coverageWhisperCheck";

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
