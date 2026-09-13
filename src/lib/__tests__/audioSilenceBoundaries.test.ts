import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

import { boundariesOnVoice, measureMaster, parseSilences } from "../audioSilenceBoundaries";

// "El chiste tan suyo" (ES Latam B2 Traveler, cmtpls1l20007j8epwgcs6e1h). Master
// YA narrado; se mide, no se sintetiza nada. Fragmento 5 = [47.077, 65.156] y
// el master dura 65.155771 s: la voz se apaga en los ultimos 0,1 s, menos que
// el minimo del detector, asi que el final no sale como silencio.
const CHISTE_URL =
  "https://pub-ef067ab826f24d8fbe43b2ac2469bd3a.r2.dev/media/generated/audio/El_chiste_tan_suyo_multivoice_1789129568836.mp3";
const CHISTE_DUR = 65.155771;
const CHISTE_FRAGS: Array<[number, number, number]> = [
  [0, 0, 1.884], [1, 1.884, 9.601], [2, 9.601, 22.118],
  [3, 22.118, 32.477], [4, 32.477, 47.077], [5, 47.077, 65.156],
];
// Ultimos silencios que ffmpeg detecta en ese master (salida real, recortada).
const CHISTE_TAIL = [
  "silence_start: 46.753271", "silence_end: 47.400625 | silence_duration: 0.647354",
  "silence_start: 62.812479", "silence_end: 63.021896 | silence_duration: 0.209417",
  "silence_start: 63.380562", "silence_end: 63.501667 | silence_duration: 0.121104",
].join("\n");

describe("boundariesOnVoice", () => {
  it("el final del master es frontera valida para el ultimo fragmento", () => {
    const silences = parseSilences(CHISTE_TAIL, CHISTE_DUR);
    expect(boundariesOnVoice({ silences, startSec: 47.077, endSec: 65.156, durationSec: CHISTE_DUR })).toEqual([]);
  });

  it("sigue rechazando una frontera sobre voz en mitad del audio", () => {
    const silences = parseSilences(CHISTE_TAIL, CHISTE_DUR);
    expect(boundariesOnVoice({ silences, startSec: 47.077, endSec: 55.0, durationSec: CHISTE_DUR }))
      .toEqual([["final", 55.0]]);
  });

  it("un final a mas de la holgura del cierre del master no pasa", () => {
    expect(boundariesOnVoice({ silences: [], startSec: 0, endSec: 64.9, durationSec: CHISTE_DUR }))
      .toEqual([["final", 64.9]]);
  });

  it("cierra en la duracion un silencio abierto al final", () => {
    expect(parseSilences("silence_start: 10.5", 12)).toEqual([[10.5, 12]]);
    expect(parseSilences("silence_start: 10.5")).toEqual([]);
  });
});

const hasFfmpeg = spawnSync("ffmpeg", ["-version"]).status === 0;

describe.skipIf(!hasFfmpeg || process.env.DPL_OFFLINE === "1")("master real de el-chiste-tan-suyo", () => {
  it("todas las fronteras, incluido el final del fragmento 5, caen en silencio o en un extremo", () => {
    const m = measureMaster(CHISTE_URL);
    expect(m.ok).toBe(true);
    expect(m.durationSec).toBeCloseTo(CHISTE_DUR, 1);
    for (const [index, startSec, endSec] of CHISTE_FRAGS) {
      const malas = boundariesOnVoice({ silences: m.silences, startSec, endSec, durationSec: m.durationSec });
      expect({ index, malas }).toEqual({ index, malas: [] });
    }
    // Sin la regla del extremo, el fragmento 5 caeria sobre voz: es el bug.
    expect(m.silences.some(([a, b]) => 65.156 >= a - 0.08 && 65.156 <= b + 0.08)).toBe(false);
  }, 60_000);
});
