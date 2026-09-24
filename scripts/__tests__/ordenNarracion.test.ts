/**
 * ORDEN DE NARRACION (regla dura 2026-09-02, aflojada el 2026-09-23).
 *
 * Lo que se prueba aqui es exactamente lo que cambio y lo que NO puede cambiar:
 * la muestra pasa de una por tema a una por journey, el tema se narra entero, y
 * un journey empezado con el orden viejo sigue narrandose sin re-tirar nada.
 */
import { describe, it, expect } from "vitest";
import { muestraDelJourney, pasoDelOrden, vozYaAprobada } from "../_narraPerfiles";

const JOURNEY = "cmubidgaf0007j8np6g7n89iu";
const OTRO = "cmtgelq560007j84n3ujx9bpd";

describe("muestraDelJourney", () => {
  it("encuentra la muestra por el campo `journey` de las entradas nuevas", () => {
    const muestras = { "una-cualquiera": { url: "u", journey: JOURNEY } };
    expect(muestraDelJourney(muestras, JOURNEY, [])).toBe("una-cualquiera");
  });

  it("encuentra las entradas VIEJAS, sin campo `journey`, por el slug", () => {
    // Todas las muestras registradas antes del 2026-09-23 son asi. Sin este
    // camino, un journey a medio narrar pediria muestra otra vez: creditos
    // gastados por un cambio de proceso.
    const muestras = { "alles-super-in-frankfurt": { url: "u", voiceId: "v" } };
    expect(muestraDelJourney(muestras, JOURNEY, ["alles-super-in-frankfurt", "zu-schnell-am-main"]))
      .toBe("alles-super-in-frankfurt");
  });

  it("no toma por propia la muestra de OTRO journey", () => {
    const muestras = { "muy-interesante": { url: "u", journey: OTRO } };
    expect(muestraDelJourney(muestras, JOURNEY, ["alles-super-in-frankfurt"])).toBeNull();
  });

  it("sin muestras, null", () => {
    expect(muestraDelJourney({}, JOURNEY, ["alles-super-in-frankfurt"])).toBeNull();
  });
});

describe("vozYaAprobada: el cambio no puede ENDURECER un journey en curso", () => {
  it("un journey virgen, sin muestra y sin nada narrado, exige muestra", () => {
    expect(vozYaAprobada(null, 0)).toBe(false);
  });

  it("con muestra registrada, aprobada", () => {
    expect(vozYaAprobada("la-mascara-quieta", 0)).toBe(true);
  });

  it("con historias YA narradas y sin muestra en el registro, aprobada", () => {
    // Caso real: el ES A0 cultural tiene 12 de 21 narradas y ninguna entrada
    // en a2-muestras.json. Con el orden viejo, la 2a y la 3a de un tema cuya
    // primera tenia audio pasaban; exigirles muestra ahora seria endurecer la
    // regla a mitad de journey, y ademas la voz ya paso por el oido del usuario.
    expect(vozYaAprobada(null, 12)).toBe(true);
  });
});

describe("pasoDelOrden", () => {
  it("sin muestra del journey, se para y pide la muestra", () => {
    const o = pasoDelOrden({ slug: "la-primera", audioUrl: null }, false);
    expect(o.paso).toBe("muestra");
    expect(o.bloqueo).toMatch(/muestra/);
  });

  it("con muestra del journey, CUALQUIER historia se narra sin esperar a otra", () => {
    // Este es el cambio: la tercera de un tema ya no exige que la primera
    // tenga audioUrl. El tema se narra entero, seguido.
    for (const slug of ["primera", "segunda", "tercera"]) {
      const o = pasoDelOrden({ slug, audioUrl: null }, true);
      expect(o.paso).toBe("tema entero");
      expect(o.bloqueo).toBeUndefined();
    }
  });

  it("una historia ya narrada no vuelve a entrar en el orden", () => {
    expect(pasoDelOrden({ slug: "x", audioUrl: "https://r2/x.mp3" }, true).paso).toBe("ya narrada");
    expect(pasoDelOrden({ slug: "x", audioUrl: "https://r2/x.mp3" }, false).paso).toBe("ya narrada");
  });
});

describe("el registro real de muestras sigue valiendo", () => {
  it("las entradas de a2-muestras.json se resuelven por slug", async () => {
    const { muestrasRegistradas } = await import("../_narraPerfiles");
    const reg = muestrasRegistradas();
    const slugs = Object.keys(reg);
    expect(slugs.length).toBeGreaterThan(0);
    // Un journey cuyo unico dato es que una de sus historias tiene muestra
    // registrada: es la situacion de todos los journeys en curso.
    expect(muestraDelJourney(reg, "journey-sin-marcar", [slugs[0]])).toBe(slugs[0]);
  });
});
