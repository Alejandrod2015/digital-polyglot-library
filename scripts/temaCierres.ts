/**
 * El registro de cierres de tema (I3): "listo" es una entrada escrita por un
 * script que corrio las comprobaciones, nunca una frase del chat.
 *
 * Lo escribe scripts/cierraTema.ts y lo lee el candado de scripts/saveStory.ts.
 * Vive en scripts/tema-cierres.json, commiteado, para que el cierre sobreviva
 * al chat que lo hizo.
 */
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";

export const REGISTRO = path.join(__dirname, "tema-cierres.json");

export type HistoriaCierre = {
  topic: string;
  slotIndex: number;
  title?: string | null;
  text?: string | null;
  vocab?: unknown;
};

/** Lo que una historia del tema quiere, que se lo impide, que le cuesta y que cambia. */
export type PlanHistoria = {
  slot: string;
  quiere: string;
  impide: string;
  cuesta: string;
  cambia: string;
};

/**
 * El PLAN del tema: lo que se decide ANTES de escribir la primera linea de
 * prosa. No es documentacion; es el bloque sin el cual el tema no cierra.
 * `espina` es el hilo que atraviesa el journey y `registro` el tono declarado,
 * que el cierre compara con el de los dos temas anteriores.
 */
export type PlanTema = {
  tipo: string;
  nivel: string;
  variante: string;
  registro: string;
  espina: string;
  historias: PlanHistoria[];
};

export type Cierre = {
  /** ISO del momento en que se escribio. */
  cerrado: string;
  /** Hash del CONTENIDO de las historias del tema; si el texto cambia, caduca. */
  hash: string;
  historias: string[];
  checks: string[];
  /** Lo que no se pudo medir con el journey a medias, escrito y no escondido. */
  pendientesDeConjunto: string[];
  /** El plan con el que se escribio el tema. Obligatorio desde el 2026-09-05. */
  plan?: PlanTema;
  /** Lo medido que no bloquea, guardado para que no se pierda al cerrar. */
  avisos?: string[];
};

export const CAMPOS_PLAN = ["tipo", "nivel", "variante", "registro", "espina"] as const;
export const CAMPOS_PLAN_HISTORIA = ["slot", "quiere", "impide", "cuesta", "cambia", "emocion"] as const;

/**
 * Devuelve lo que FALTA en un plan, campo a campo y por su nombre. Vacio quiere
 * decir que el plan esta completo. Un campo que no es una cadena con algo
 * escrito cuenta como ausente: "" y "   " no son decisiones.
 */
export function faltaEnPlan(plan: unknown, historiasEsperadas = 3): string[] {
  const falta: string[] = [];
  if (!plan || typeof plan !== "object" || Array.isArray(plan)) return ["el plan entero (no es un objeto JSON)"];
  const p = plan as Record<string, unknown>;
  const lleno = (v: unknown) => typeof v === "string" && v.trim().length > 0;
  for (const c of CAMPOS_PLAN) if (!lleno(p[c])) falta.push(c);
  const hs = Array.isArray(p.historias) ? (p.historias as unknown[]) : null;
  if (!hs) {
    falta.push(`historias (lista de ${historiasEsperadas})`);
    return falta;
  }
  if (hs.length !== historiasEsperadas)
    falta.push(`historias: hay ${hs.length} y el tema necesita ${historiasEsperadas}`);
  hs.forEach((h, i) => {
    const o = (h ?? {}) as Record<string, unknown>;
    for (const c of CAMPOS_PLAN_HISTORIA) if (!lleno(o[c])) falta.push(`historias[${i}].${c}`);
  });
  return falta;
}

export type Registro = Record<string, Cierre>;

export const claveCierre = (journeyId: string, topic: string) => `${journeyId}#${topic}`;

/**
 * Hash del contenido de un tema. Entra lo que hace que el cierre valga: el
 * titulo, el cuerpo y las plazas de vocab. Si cualquiera cambia, el cierre
 * caduca y el tema hay que volver a cerrarlo.
 */
export function hashTema(historias: HistoriaCierre[]): string {
  const h = crypto.createHash("sha256");
  for (const s of [...historias].sort((a, b) => a.slotIndex - b.slotIndex)) {
    const palabras = Array.isArray(s.vocab)
      ? (s.vocab as Array<{ word?: unknown }>).map((v) => String(v?.word ?? "")).join(",")
      : "";
    h.update(`${s.slotIndex}\0${s.title ?? ""}\0${s.text ?? ""}\0${palabras}\0`);
  }
  return h.digest("hex").slice(0, 16);
}

export function leerRegistro(): Registro {
  try {
    return JSON.parse(fs.readFileSync(REGISTRO, "utf8")) as Registro;
  } catch {
    return {};
  }
}

export function escribirCierre(journeyId: string, topic: string, c: Cierre): void {
  const reg = leerRegistro();
  reg[claveCierre(journeyId, topic)] = c;
  const ordenado: Registro = {};
  for (const k of Object.keys(reg).sort()) ordenado[k] = reg[k];
  fs.writeFileSync(REGISTRO, JSON.stringify(ordenado, null, 2) + "\n");
}

/**
 * EL CANDADO. Devuelve el mensaje de bloqueo, o null si se puede guardar.
 *
 * La regla: no se guardan historias de un tema mientras el tema ANTERIOR del
 * journey no tenga un cierre registrado y vigente. Vigente quiere decir que el
 * hash del cierre coincide con lo que hay hoy en la base: si el texto del tema
 * anterior cambio despues de cerrarse, el cierre caduco y hay que rehacerlo.
 *
 * No hay variable de escape, a proposito. Como la muestra de narracion, el
 * error escupe el comando que falta.
 *
 * @param topicsOrden  los temas del journey en orden de lectura (Journey.topics)
 * @param temasEnTanda los temas que se estan guardando ahora
 * @param historiasPorTema  lo que hay HOY en la base, por tema
 */
export function candadoCierrePrevio(args: {
  journeyId: string;
  topicsOrden: string[];
  temasEnTanda: string[];
  historiasPorTema: Map<string, HistoriaCierre[]>;
  registro?: Registro;
}): string | null {
  const { journeyId, topicsOrden, temasEnTanda, historiasPorTema } = args;
  const registro = args.registro ?? leerRegistro();
  // Sin orden de temas no se puede saber cual es el anterior. Callarse aqui
  // seria pasar en vacio, asi que se dice y no se bloquea: el journey no tiene
  // estructura de temas que vigilar.
  if (!topicsOrden.length) return null;

  for (const tema of temasEnTanda) {
    const i = topicsOrden.indexOf(tema);
    if (i <= 0) continue; // el primero del journey no tiene anterior
    const anterior = topicsOrden[i - 1];
    // Guardar los dos temas en la misma tanda es UNA edicion, no un salto.
    if (temasEnTanda.includes(anterior)) continue;

    const previas = (historiasPorTema.get(anterior) ?? []).filter((s) => String(s.text ?? "").trim());
    const cierre = registro[claveCierre(journeyId, anterior)];

    if (!previas.length) {
      return (
        `el tema "${tema}" va detras de "${anterior}", que no tiene ni una historia escrita.\n` +
        `  Los temas se escriben en orden: un tema se cierra antes de empezar el siguiente.`
      );
    }
    if (!cierre) {
      return (
        `el tema anterior ("${anterior}") no tiene cierre registrado.\n` +
        `  Cierralo antes de guardar "${tema}":\n` +
        `    npx tsx scripts/cierraTema.ts ${journeyId} ${anterior}`
      );
    }
    const hoy = hashTema(previas);
    if (hoy !== cierre.hash) {
      return (
        `el cierre del tema anterior ("${anterior}") caduco: su texto cambio despues de cerrarse\n` +
        `  (cierre ${cierre.hash} del ${cierre.cerrado.slice(0, 10)}, contenido de hoy ${hoy}).\n` +
        `  Vuelve a cerrarlo:\n` +
        `    npx tsx scripts/cierraTema.ts ${journeyId} ${anterior}`
      );
    }
  }
  return null;
}
