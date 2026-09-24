/**
 * Check "journey-write-target": contra QUE journey se esta escribiendo.
 *
 * `scripts/saveStory.ts` es el gate canonico por el que pasa TODO contenido de
 * historia hacia la base, y hasta hoy no miraba el destino: el nivel salia del
 * argumento `--level` y nunca se comparaba con `journey.levels`, y el `status`
 * del journey no se leia nunca. Un journey `active` (publicado, con usuarios
 * dentro) se dejaba escribir igual que un `draft`.
 *
 * El 2026-09-23 se paso por error el id de un Friends ES/Colombia C1 (active,
 * 21 historias narradas y con portadas) para guardar texto A0. Lo unico que lo
 * freno fue que el `findFirst` por `topic` no encontro slot, porque ese C1 usa
 * topics de ciudades. Con los mismos nombres de tema, el texto A0 habria caido
 * encima de un journey publicado. Suerte, no gate.
 *
 * Las dos comprobaciones corren ANTES de cualquier escritura y tambien en
 * `--dry`. El nivel no tiene escape. El journey publicado si lo tiene, porque
 * corregir una errata en un journey live es legitimo, pero es visible y por
 * comando: DPL_WRITE_TO_LIVE_JOURNEY=1.
 */

export const OPT_IN_LIVE = "DPL_WRITE_TO_LIVE_JOURNEY";

export type JourneyDestino = {
  id: string;
  name: string;
  levels: string[];
  status: string;
};

export type VeredictoDestino =
  | { ok: true }
  | { ok: false; motivo: "level-mismatch" | "live-journey"; mensaje: string };

/** El id del check, para el inventario de reglas: "journey-write-target". */
export const CHECK_ID = "journey-write-target";

function norm(v: string): string {
  return String(v ?? "").trim().toLowerCase();
}

/**
 * @param nivelPedido  el `--level` de la linea de comando
 * @param journey      el journey destino, leido de la base
 * @param optInLive    true si DPL_WRITE_TO_LIVE_JOURNEY=1 va en el entorno
 */
export function verificaDestino(
  nivelPedido: string,
  journey: JourneyDestino,
  optInLive: boolean
): VeredictoDestino {
  const quien = `journey ${journey.id} ("${journey.name}")`;
  const niveles = journey.levels ?? [];

  if (!niveles.map(norm).includes(norm(nivelPedido))) {
    return {
      ok: false,
      motivo: "level-mismatch",
      mensaje:
        `FAIL [${CHECK_ID}]: nivel pedido "${nivelPedido}", pero el ${quien} ` +
        `es de nivel ${niveles.length ? niveles.join(", ") : "(sin niveles declarados)"}.\n` +
        `  Nada escrito. Comprueba el --journey: escribir nivel "${nivelPedido}" aqui ` +
        `pisaria contenido de otro nivel. Sin variable de escape.`,
    };
  }

  if (norm(journey.status) === "active" && !optInLive) {
    return {
      ok: false,
      motivo: "live-journey",
      mensaje:
        `FAIL [${CHECK_ID}]: el ${quien} esta PUBLICADO (status active): tiene usuarios dentro.\n` +
        `  Nada escrito. Si de verdad quieres corregir contenido live, repite el comando con ` +
        `${OPT_IN_LIVE}=1 delante, y sabe lo que tocas.`,
    };
  }

  return { ok: true };
}

/** Lee el opt-in del entorno. Solo "1" cuenta; no vale "true" ni "si". */
export function optInLiveDelEntorno(env: NodeJS.ProcessEnv = process.env): boolean {
  return env[OPT_IN_LIVE] === "1";
}
