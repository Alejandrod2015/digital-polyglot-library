import { describe, expect, it } from "vitest";
import { orderTracksByPlacement, type OrderableTrack } from "@/lib/journeyTrackOrder";

/** El catalogo LATAM real el 2026-08-25: a0, a1 y c1, sin nada en B. */
const LATAM: OrderableTrack[] = [
  { label: "Traveler", variant: "latam", levels: [{ id: "a0" }] },
  { label: "Traveler", variant: "mexico", levels: [{ id: "a0" }] },
  { label: "Traveler", variant: "latam", levels: [{ id: "a1" }] },
  { label: "Friends", variant: "colombia", levels: [{ id: "c1" }] },
  { label: "Friends", variant: "latam", levels: [{ id: "c1" }] },
];

const first = (tracks: OrderableTrack[]) => `${tracks[0]?.label}/${tracks[0]?.variant}/${tracks[0]?.levels[0]?.id}`;

describe("orderTracksByPlacement", () => {
  it("pone primero el track del nivel exacto del placement", () => {
    expect(first(orderTracksByPlacement(LATAM, "a1", "latam"))).toBe("Traveler/latam/a1");
    expect(first(orderTracksByPlacement(LATAM, "c1", "latam"))).toBe("Friends/latam/c1");
    expect(first(orderTracksByPlacement(LATAM, "a0", "latam"))).toBe("Traveler/latam/a0");
  });

  it("sin nivel exacto, coge el MAS CERCANO y no el mas facil", () => {
    // El caso de Ty: B2, y el catalogo LATAM salta de a1 a c1. c1 esta a 1 de
    // distancia y a1 a 3, asi que gana c1. Antes de esto aterrizaba en a0.
    expect(first(orderTracksByPlacement(LATAM, "b2", "latam"))).toBe("Friends/latam/c1");
  });

  it("a igual distancia gana su variante EXACTA, no el orden alfabetico", () => {
    // Los dos C1 empatan a distancia 1 de b2 y comparten label ("Friends"), asi
    // que sin este criterio salia el de Colombia.
    const orden = orderTracksByPlacement(LATAM, "b2", "latam");
    expect(first(orden)).toBe("Friends/latam/c1");
    expect(`${orden[1]?.label}/${orden[1]?.variant}`).toBe("Friends/colombia");
  });

  it("a igual distancia y misma variante, gana el nivel de ABAJO", () => {
    const conB1yC1: OrderableTrack[] = [
      { label: "Zeta", variant: "latam", levels: [{ id: "c1" }] },
      { label: "Alfa", variant: "latam", levels: [{ id: "b1" }] },
    ];
    // b1 y c1 estan los dos a 1 de b2; se lee entero el de abajo.
    expect(first(orderTracksByPlacement(conB1yC1, "b2", "latam"))).toBe("Alfa/latam/b1");
  });

  it("sin placement no reordena nada", () => {
    expect(orderTracksByPlacement(LATAM, null, "latam")).toEqual(LATAM);
    expect(orderTracksByPlacement(LATAM, "", "latam")).toEqual(LATAM);
    expect(orderTracksByPlacement(LATAM, "no-es-un-nivel", "latam")).toEqual(LATAM);
  });

  it("sin variante del alumno sigue ordenando por nivel", () => {
    expect(first(orderTracksByPlacement(LATAM, "a1", null))).toBe("Traveler/latam/a1");
  });

  it("no muta el array que recibe", () => {
    const copia = [...LATAM];
    orderTracksByPlacement(LATAM, "b2", "latam");
    expect(LATAM).toEqual(copia);
  });

  it("un track sin niveles reconocibles cae al final, no rompe", () => {
    const conBasura: OrderableTrack[] = [
      { label: "Basura", variant: "latam", levels: [{ id: "zz" }] },
      ...LATAM,
    ];
    const orden = orderTracksByPlacement(conBasura, "b2", "latam");
    expect(first(orden)).toBe("Friends/latam/c1");
    expect(orden[orden.length - 1]?.label).toBe("Basura");
  });
});
