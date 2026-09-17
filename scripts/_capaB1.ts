/**
 * Capa de contexto que faltaba en el B1 de España (2026-09-05).
 * Escribe `c` para las expresiones de varias palabras (que no viven en la
 * glosa global: van en la fila de SU historia, spec §4) y pone el infinitivo
 * a la vista en los verbos que el conjugador no sabe conjugar.
 */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import { PrismaClient } from "../src/generated/prisma";

const BUNDLE = "spanish-traveler-spain-b1";
type C = { es: string; en: string };
type Nueva = { g: string; t: string; c: C };

const CAPA: Record<string, Record<string, Nueva>> = {
  "tres-horas-por-un-punto": {
    "sala de espera": { g: "waiting room", t: "noun", c: { es: "la sala de espera ya está llena", en: "the waiting room is already full" } },
    "antes que nada": { g: "before anything else", t: "expression", c: { es: "eso lo dejo claro antes que nada", en: "I make that clear before anything else" } },
    "cuanto antes": { g: "as soon as possible", t: "expression", c: { es: "termina lo tuyo cuanto antes", en: "finish yours as soon as you can" } },
    "de vez en cuando": { g: "now and then", t: "expression", c: { es: "de vez en cuando sale un tema", en: "now and then a real topic comes up" } },
    "mientras tanto": { g: "meanwhile", t: "expression", c: { es: "mientras tanto el encargo la espera", en: "meanwhile the job is still waiting for her" } },
    "tres horas": { g: "three hours", t: "expression", c: { es: "no le ha quitado trabajo, solo tres horas", en: "it has taken no work off her, only three hours" } },
    "desde luego": { g: "of course", t: "expression", c: { es: "Desde luego la reunión no le ha quitado trabajo", en: "Of course the meeting has taken no work off her" } },
  },
  "nuria-no-negocia": {
    "ahora bien": { g: "that said", t: "expression", c: { es: "Ahora bien, esto no es Madrid", en: "That said, this is not Madrid" } },
  },
  "la-cuota-no-espera": {
    "hace falta": { g: "is needed", t: "expression", c: { es: "Le hace falta un mes de aire", en: "She needs a month to breathe" } },
    "hacer falta": { g: "to be needed", t: "expression", c: { es: "Le hace falta un mes de aire", en: "She needs a month to breathe" } },
    "todo el mundo": { g: "everybody", t: "expression", c: { es: "Ahora alerto a todo el mundo", en: "Now I warn everybody" } },
  },
  "cobrar-es-otro-trabajo": {
    "a media mañana": { g: "mid morning", t: "expression", c: { es: "Nuria la llama a media mañana", en: "Nuria calls her mid morning" } },
    "lo tuyo": { g: "what is yours", t: "expression", c: { es: "Pedir lo tuyo no es criticar a nadie", en: "Asking for what is yours is not criticising anyone" } },
  },
  "el-retraso-no-es-suyo": {
    "hasta cierto punto": { g: "up to a point", t: "expression", c: { es: "Hasta cierto punto, eso es una costumbre", en: "Up to a point, that is a custom" } },
    "por lo pronto": { g: "for now", t: "expression", c: { es: "Por lo pronto tiene una semana entera", en: "For now she has a whole week" } },
    "media hora": { g: "half an hour", t: "expression", c: { es: "La respuesta llega en media hora", en: "The answer arrives in half an hour" } },
    "desde el principio": { g: "from the start", t: "expression", c: { es: "El retraso era suyo desde el principio", en: "The delay was theirs from the start" } },
    "hacia abajo": { g: "downwards", t: "expression", c: { es: "La urgencia se hereda hacia abajo", en: "Urgency is passed downwards" } },
  },
  "reunion-sin-orden-del-dia": {
    "punto de vista": { g: "point of view", t: "expression", c: { es: "Desde su punto de vista", en: "From her point of view" } },
    "la próxima semana": { g: "next week", t: "expression", c: { es: "mejor saberlo ya que la próxima semana", en: "better to know now than next week" } },
    "orden del día": { g: "agenda", t: "expression", c: { es: "Son cuatro líneas, sin orden del día", en: "It is four lines, with no agenda" } },
    "en persona": { g: "in person", t: "expression", c: { es: "alguien prefiere decirlo en persona", en: "someone prefers to say it in person" } },
    "tan pronto como": { g: "as soon as", t: "expression", c: { es: "Mañana, tan pronto como abran", en: "Tomorrow, as soon as they open" } },
    "por la noche": { g: "at night", t: "expression", c: { es: "El jueves por la noche llega un segundo correo", en: "On Thursday night a second email arrives" } },
    "dos veces": { g: "twice", t: "expression", c: { es: "Ella lo lee dos veces", en: "She reads it twice" } },
  },
};

// El conjugador solo sabe los infinitivos de su tabla; para el resto, la spec
// pide el infinitivo A LA VISTA entre parentesis, que es lo que se pone aqui.
const INFINITIVO: Record<string, Record<string, string>> = {
  "tres-horas-por-un-punto": { saluda: "greets (saludar)", termina: "finish it (terminar, command)" },
  "nuria-no-negocia": { admite: "admits (admitir)" },
  "cobrar-es-otro-trabajo": { "confía": "trusts (confiar)" },
  "el-retraso-no-es-suyo": { manda: "gives the orders (mandar)", discutir: "to argue (discutir)" },
  "reunion-sin-orden-del-dia": { apaga: "to turn off (apagar)", apagar: "to turn off (apagar)" },
};

(async () => {
  const p = new PrismaClient();
  const glob = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: BUNDLE, slug: "" } } });
  if (!glob) throw new Error("no hay fila global");
  for (const slug of new Set([...Object.keys(CAPA), ...Object.keys(INFINITIVO)])) {
    const fila = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: BUNDLE, slug } } });
    const capa = (fila?.glosses ?? {}) as Record<string, Record<string, unknown>>;
    let nuevas = 0, tocadas = 0;
    for (const [w, e] of Object.entries(CAPA[slug] ?? {})) {
      const previa = capa[w] ?? {};
      capa[w] = { ...previa, g: previa.g ?? e.g, t: previa.t ?? e.t, c: e.c };
      nuevas++;
    }
    for (const [w, g] of Object.entries(INFINITIVO[slug] ?? {})) {
      if (!capa[w]) continue;
      capa[w] = { ...capa[w], g };
      tocadas++;
    }
    await p.tapGlossSet.upsert({
      where: { bundle_slug: { bundle: BUNDLE, slug } },
      create: { bundle: BUNDLE, slug, language: glob.language, variant: glob.variant, slugs: [], glosses: capa as never },
      update: { glosses: capa as never },
    });
    console.log(`${slug}: ${nuevas} con frase, ${tocadas} verbos con infinitivo`);
  }
  await p.$disconnect();
})();
