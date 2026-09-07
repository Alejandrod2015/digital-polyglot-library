import { describe, expect, it } from "vitest";
import { decideKind } from "../lifecycleEngine";

/**
 * La bienvenida se mudo aqui desde el webhook de `user.created` el 2026-09-07.
 * Estas pruebas fijan las cuatro decisiones que justificaron la mudanza; sin
 * ellas, `decideKind` no tenia ni una.
 */

type Args = Parameters<typeof decideKind>[0];

function args(over: Partial<Args> = {}): Args {
  return {
    daysSinceSignup: 0,
    storiesFinished: 0,
    daysSinceActive: null,
    alreadySent: new Set<string>(),
    ...over,
  };
}

describe("decideKind: bienvenida", () => {
  it("da la bienvenida en la primera pasada tras el alta", () => {
    expect(decideKind(args())).toBe("welcome");
  });

  it("no la manda dos veces", () => {
    expect(decideKind(args({ alreadySent: new Set(["welcome"]) }))).toBe(null);
  });

  it("a quien ya termino una historia le da celebration, no bienvenida", () => {
    expect(decideKind(args({ storiesFinished: 1 }))).toBe("celebration");
  });

  it("caduca a los dos dias, para que no aparezca una bienvenida tardia", () => {
    expect(decideKind(args({ daysSinceSignup: 3 }))).toBe("nudge");
    expect(decideKind(args({ daysSinceSignup: 9, storiesFinished: 0 }))).toBe(null);
  });

  it("el rescate de un dormido manda por encima de la bienvenida", () => {
    expect(decideKind(args({ daysSinceSignup: 1, daysSinceActive: 31 }))).toBe("winReminder");
  });

  it("tras la bienvenida, el dia siguiente toca el nudge", () => {
    const sent = new Set(["welcome"]);
    expect(decideKind(args({ daysSinceSignup: 1, alreadySent: sent }))).toBe("nudge");
  });
});
