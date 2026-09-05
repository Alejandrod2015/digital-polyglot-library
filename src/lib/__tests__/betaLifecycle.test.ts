import { describe, expect, it } from "vitest";
import { decideBetaEmail } from "@/lib/betaLifecycle";
import { DEFAULT_BETA_RULES } from "@/lib/betaRules";

// El fallo que originó estas reglas: el calendario mandaba encuestas por
// antigüedad, así que el 2026-09-05 cuatro testers con 23 días dentro y CERO
// historias habían recibido peticiones de opinión, y quien terminó siete
// historias en su primer día no había recibido nada. La puerta es el uso.

const NOW = new Date("2026-09-05T11:00:00.000Z");
const rules = { ...DEFAULT_BETA_RULES, betaEndsAt: null, launchedAt: null };

function tester(daysIn: number) {
  return {
    id: "sig_1",
    email: "t@example.com",
    firstName: "T",
    targetLanguage: "Spanish",
    status: "accepted",
    invitedAt: new Date(NOW.getTime() - daysIn * 24 * 60 * 60 * 1000),
    planGrantedAt: null,
    clerkUserId: "user_1",
    lastActiveAt: NOW,
  };
}

function decide(args: { daysIn: number; stories: number; exercises: number; sent?: string[] }) {
  return decideBetaEmail({
    tester: tester(args.daysIn),
    now: NOW,
    rules,
    finalRating: null,
    storiesFinished: args.stories,
    exercisesFinished: args.exercises,
    alreadySent: new Set(args.sent ?? []),
  });
}

describe("decideBetaEmail: las peticiones van por uso, no por calendario", () => {
  it("no pide opinión a quien lleva tres semanas y no ha terminado nada", () => {
    expect(decide({ daysIn: 23, stories: 0, exercises: 0, sent: ["stuck_ask"] })).toBeNull();
  });

  it("a esa misma persona le pregunta qué la frenó, una sola vez", () => {
    expect(decide({ daysIn: 23, stories: 0, exercises: 0 })?.kind).toBe("stuck_ask");
  });

  it("no la molesta antes del séptimo día", () => {
    expect(decide({ daysIn: 3, stories: 0, exercises: 0 })).toBeNull();
  });

  it("una historia y un ejercicio abren la primera petición", () => {
    expect(decide({ daysIn: 2, stories: 1, exercises: 1 })?.kind).toBe("feedback_ask");
  });

  it("una historia sin ningún ejercicio todavía no la abre", () => {
    expect(decide({ daysIn: 9, stories: 1, exercises: 0 })).toBeNull();
  });

  it("no cae el mismo día que entra, por mucho que haya leído", () => {
    expect(decide({ daysIn: 0, stories: 7, exercises: 8 })).toBeNull();
  });

  it("tres historias y dos ejercicios abren la encuesta de mitad", () => {
    expect(decide({ daysIn: 7, stories: 3, exercises: 2 })?.kind).toBe("mid_survey");
  });

  it("con ese uso pero sin cumplir los siete días, sigue en la primera", () => {
    expect(decide({ daysIn: 4, stories: 3, exercises: 2 })?.kind).toBe("feedback_ask");
  });

  it("la de mitad no se repite, y detrás no vuelve la primera", () => {
    const d = decide({ daysIn: 20, stories: 9, exercises: 9, sent: ["mid_survey", "feedback_ask"] });
    expect(d).toBeNull();
  });

  it("sin fecha de cierre, la encuesta final no sale sola", () => {
    const d = decide({ daysIn: 40, stories: 12, exercises: 12, sent: ["feedback_ask", "mid_survey"] });
    expect(d).toBeNull();
  });
});
