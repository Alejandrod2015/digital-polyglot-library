/** Las 114 glosas copiadas de la fila global del B2 latam, leidas contra su frase
 *  (2026-09-10): 35 traian el sentido del journey de origen y se corrigen; todas
 *  quedan rev:true. Solo toca claves que siguen en rev:false. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
const CORRIGE: Record<string, string> = {
  dio: "took, gave (dar)", iba: "was (ir)", iban: "were (ir)", "cayó": "realized, fell (caer en cuenta)",
  "pasó": "spent (pasar)", "tocó": "rang (tocar timbre)", "acabó": "ended (acabarse)", bajaba: "got off, came down (bajar)",
  "colgó": "hung (colgar)", "cortó": "cut in (cortar)", estuvo: "was about to (estar por)", "frenó": "pulled up, braked (frenar)",
  jugaba: "was at stake (jugarse)", pasaba: "passed (pasar)", sacaba: "worked out (sacar la cuenta)",
  "soltó": "burst out, blurted (soltar)", sonaba: "sounded (sonar)", "subió": "went up (subir)",
  "acercó": "pushed over, brought closer (acercar)", "apartó": "set aside (apartar)", cayeron: "came in, arrived (caer)",
  "corrió": "ran (correr)", "escapó": "slipped away (escaparse)", faltaba: "was short of, lacked (faltar)",
  hablara: "speak (subjunctive of hablar)", "remató": "wrapped up, closed with (rematar)", "vendía": "sold (vender)",
  perdiera: "lost (subjunctive of perder)", "preparó": "was prepared (prepararse)", saludaba: "waved, greeted (saludar)",
  "amaneció": "turned up at dawn with (amanecer)", "escondió": "hid (esconder)", acomodaron: "settled in (acomodarse)",
  contestaba: "answered (contestar)", miraba: "checked, looked at (mirar)",
};
(async () => {
  const fila = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: "spanish-traveler-latam-b2", slug: "" } } });
  if (!fila) throw new Error("sin fila global");
  const g = { ...(fila.glosses as Record<string, any>) };
  let leidas = 0, corregidas = 0;
  const sinPend = Object.keys(CORRIGE).filter((k) => g[k]?.rev !== false);
  if (sinPend.length) throw new Error(`corrijo claves que no estaban pendientes: ${sinPend.join(", ")}`);
  for (const [k, v] of Object.entries(g)) {
    if (v?.rev !== false) continue;
    g[k] = { ...v, ...(CORRIGE[k] ? { g: CORRIGE[k] } : {}), rev: true };
    leidas++; if (CORRIGE[k]) corregidas++;
  }
  await p.tapGlossSet.update({ where: { id: fila.id }, data: { glosses: g as never } });
  console.log(`leidas ${leidas} · corregidas ${corregidas}`);
  await p.$disconnect();
})();
