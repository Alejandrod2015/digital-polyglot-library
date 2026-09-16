import { describe, it, expect } from "vitest";
import { buildGateFlags } from "../elevenlabs";

// Sin re-tiro (2026-09-16): buildGateFlags es lo que decide que se marca en
// gateFlags cuando el pipeline mide UNA sola toma. Puro, sin red: aqui se
// prueba sin tocar ElevenLabs ni whisper.
describe("buildGateFlags", () => {
  it("sin problema, sin flags", () => {
    expect(buildGateFlags(0, null, 1.2, 4.0)).toEqual([]);
  });

  it("divergencia de contenido: un flag kind content", () => {
    expect(buildGateFlags(1, 'se oye "nochmal"', 1.0, 4.0)).toEqual([
      { index: 1, kind: "content", detail: 'se oye "nochmal"' },
    ]);
  });

  it("pitch por encima del umbral: un flag kind uptalk con pitchSt", () => {
    expect(buildGateFlags(0, null, 8.6, 4.0)).toEqual([
      { index: 0, kind: "uptalk", detail: "+8.6 st", pitchSt: 8.6 },
    ]);
  });

  it("pitch justo en el umbral cuenta (>=), justo debajo no", () => {
    expect(buildGateFlags(2, null, 4.0, 4.0)).toHaveLength(1);
    expect(buildGateFlags(2, null, 3.99, 4.0)).toEqual([]);
  });

  it("pitch null (F0 no disponible) no marca nada", () => {
    expect(buildGateFlags(0, null, null, 4.0)).toEqual([]);
  });

  it("ambos gates pueden marcar el mismo fragmento a la vez", () => {
    const flags = buildGateFlags(3, 'se oye "besorgt"', 8.9, 4.0);
    expect(flags).toEqual([
      { index: 3, kind: "content", detail: 'se oye "besorgt"' },
      { index: 3, kind: "uptalk", detail: "+8.9 st", pitchSt: 8.9 },
    ]);
  });
});
