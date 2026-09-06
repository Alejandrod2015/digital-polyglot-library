/** Un verbo sin tabla se quedaba tambien sin infinitivo, porque el lema vive
 *  dentro del bloque `f`. El infinitivo se puede dar siempre, se sepa conjugar
 *  o no, y es la convencion que ya usan las glosas escritas a mano:
 *  "checks (comprobar)". */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const INF: Record<string, string> = {
  acepta: "aceptar", apunta: "apuntar", "añade": "añadir", abre: "abrir", arrastra: "arrastrar",
  arrastrado: "arrastrar", avisa: "avisar", bajado: "bajar", busca: "buscar", calla: "callar",
  cambia: "cambiar", "cambiará": "cambiar", cierra: "cerrar", comprobado: "comprobar",
  contestar: "contestar", corta: "cortar", decide: "decidir", decir: "decir", deja: "dejar",
  dejarlo: "dejar", depende: "depender", devuelve: "devolver", "enseñado": "enseñar",
  escapa: "escapar", espera: "esperar", estira: "estirar", "está": "estar", es: "ser",
  faltara: "faltar", firmar: "firmar", hace: "hacer", han: "haber", hay: "haber", ha: "haber",
  hemos: "haber", huele: "oler", lee: "leer", levanta: "levantar", llega: "llegar", lleva: "llevar",
  mira: "mirar", mudado: "mudarse", mueve: "mover", ofrece: "ofrecer", pagar: "pagar",
  pasa: "pasar", pega: "pegar", pide: "pedir", promete: "prometer", revisa: "revisar",
  sabe: "saber", sale: "salir", son: "ser", suena: "sonar", tapar: "tapar", tarda: "tardar",
  va: "ir", viendo: "ver", vive: "vivir", probado: "probar", "saldrá": "salir",
  contesta: "contestar", cuelga: "colgar", dice: "decir", empieza: "empezar", enciende: "encender",
};
(async () => {
  const p = new PrismaClient();
  const filas = await p.tapGlossSet.findMany({ where: { bundle: "spanish-traveler-spain-b1" } });
  let n = 0;
  for (const f of filas) {
    const g = f.glosses as Record<string, any>;
    let toco = false;
    for (const [w, inf] of Object.entries(INF)) {
      const e = g[w];
      if (!e || e.t !== "verb" || e.f) continue;
      if (new RegExp(`\\(${inf}[,)]`).test(String(e.g))) continue;
      if (w === inf) continue;                       // el infinitivo ya ES la palabra
      e.g = `${e.g} (${inf})`; n++; toco = true;
    }
    if (toco) await p.tapGlossSet.update({ where: { bundle_slug: { bundle: f.bundle, slug: f.slug } }, data: { glosses: g } });
  }
  console.log(`infinitivos añadidos: ${n}`);
  await p.$disconnect();
})();
