import { describe, it, expect } from "vitest";
import { verificaDestino, optInLiveDelEntorno, type JourneyDestino } from "../journeyWriteTarget";

const C1_LIVE: JourneyDestino = {
  id: "cmrpm0tra000032vgxcs33wrb",
  name: "Friends",
  levels: ["C1"],
  status: "active",
};
const A0_DRAFT: JourneyDestino = {
  id: "j-a0-draft",
  name: "Traveler",
  levels: ["A0"],
  status: "draft",
};

describe("verificaDestino", () => {
  it("el nivel coincide y el journey es draft: pasa", () => {
    const v = verificaDestino("A0", A0_DRAFT, false);
    expect(v.ok).toBe(true);
  });

  it("el nivel coincide sin importar mayusculas ni espacios", () => {
    expect(verificaDestino(" a0 ", A0_DRAFT, false).ok).toBe(true);
  });

  it("el nivel NO coincide: para, y el mensaje dice nivel, niveles, id y nombre", () => {
    const v = verificaDestino("a0", C1_LIVE, true);
    expect(v.ok).toBe(false);
    if (v.ok) throw new Error("inalcanzable");
    expect(v.motivo).toBe("level-mismatch");
    expect(v.mensaje).toContain("a0");
    expect(v.mensaje).toContain("C1");
    expect(v.mensaje).toContain("cmrpm0tra000032vgxcs33wrb");
    expect(v.mensaje).toContain("Friends");
  });

  it("el nivel manda sobre el opt-in: con el opt-in puesto sigue parando por nivel", () => {
    const v = verificaDestino("B1", C1_LIVE, true);
    expect(v.ok).toBe(false);
    if (v.ok) throw new Error("inalcanzable");
    expect(v.motivo).toBe("level-mismatch");
  });

  it("journey active sin opt-in: para, y el mensaje nombra la variable", () => {
    const v = verificaDestino("C1", C1_LIVE, false);
    expect(v.ok).toBe(false);
    if (v.ok) throw new Error("inalcanzable");
    expect(v.motivo).toBe("live-journey");
    expect(v.mensaje).toContain("DPL_WRITE_TO_LIVE_JOURNEY=1");
    expect(v.mensaje).toContain("cmrpm0tra000032vgxcs33wrb");
    expect(v.mensaje).toContain("Friends");
  });

  it("journey active CON opt-in y nivel correcto: pasa", () => {
    expect(verificaDestino("C1", C1_LIVE, true).ok).toBe(true);
  });

  it("un journey sin niveles declarados no deja escribir nada", () => {
    const v = verificaDestino("A1", { ...A0_DRAFT, levels: [] }, false);
    expect(v.ok).toBe(false);
    if (v.ok) throw new Error("inalcanzable");
    expect(v.motivo).toBe("level-mismatch");
  });
});

describe("optInLiveDelEntorno", () => {
  it("solo el 1 cuenta", () => {
    expect(optInLiveDelEntorno({} as NodeJS.ProcessEnv)).toBe(false);
    expect(optInLiveDelEntorno({ DPL_WRITE_TO_LIVE_JOURNEY: "1" } as NodeJS.ProcessEnv)).toBe(true);
    expect(optInLiveDelEntorno({ DPL_WRITE_TO_LIVE_JOURNEY: "true" } as NodeJS.ProcessEnv)).toBe(false);
    expect(optInLiveDelEntorno({ DPL_WRITE_TO_LIVE_JOURNEY: "0" } as NodeJS.ProcessEnv)).toBe(false);
  });
});
