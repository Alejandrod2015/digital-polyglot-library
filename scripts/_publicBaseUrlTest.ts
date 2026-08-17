/**
 * Un host local nunca puede salir en un correo enviado.
 *
 * El 2026-08-17 estuvieron a punto de irse cuatro invitaciones de beta con
 * todos sus enlaces apuntando a http://localhost:3000, porque los correos
 * leían APP_BASE_URL a pelo y en `.env.local` vale eso. Se vio en el paso en
 * seco; sin él habrían salido, y un correo enviado no se recoge.
 *
 *   npx tsx scripts/_publicBaseUrlTest.ts
 */
import { publicBaseUrl } from "../src/lib/emails/publicBaseUrl";

const CASOS: Array<{ entrada: string | null | undefined; esperado: string; nota: string }> = [
  { entrada: "http://localhost:3000", esperado: "https://digitalpolyglot.com", nota: "localhost con puerto" },
  { entrada: "https://localhost", esperado: "https://digitalpolyglot.com", nota: "localhost sin puerto" },
  { entrada: "http://127.0.0.1:3000", esperado: "https://digitalpolyglot.com", nota: "IP local" },
  { entrada: "http://0.0.0.0:8080", esperado: "https://digitalpolyglot.com", nota: "todas las interfaces" },
  { entrada: "https://digitalpolyglot.com", esperado: "https://digitalpolyglot.com", nota: "producción intacta" },
  { entrada: "https://www.digitalpolyglot.com", esperado: "https://www.digitalpolyglot.com", nota: "www intacta" },
  { entrada: "https://reader.digitalpolyglot.com/", esperado: "https://reader.digitalpolyglot.com", nota: "barra final fuera" },
  { entrada: "https://staging.digitalpolyglot.com", esperado: "https://staging.digitalpolyglot.com", nota: "staging no es local" },
];

let fallos = 0;
for (const c of CASOS) {
  const dio = publicBaseUrl(c.entrada);
  const ok = dio === c.esperado;
  if (!ok) fallos++;
  console.log(`${ok ? "ok   " : "FALLO"} ${c.nota.padEnd(26)} ${String(c.entrada)} -> ${dio}`);
}

// Sin argumento cae en APP_BASE_URL, que en local es el host de desarrollo.
process.env.APP_BASE_URL = "http://localhost:3000";
const sinArg = publicBaseUrl();
const okEnv = sinArg === "https://digitalpolyglot.com";
if (!okEnv) fallos++;
console.log(`${okEnv ? "ok   " : "FALLO"} ${"APP_BASE_URL local".padEnd(26)} (sin argumento) -> ${sinArg}`);

console.log(`\n${CASOS.length + 1 - fallos}/${CASOS.length + 1} correctos`);
if (fallos) { console.log("✗ un host local podría colarse en un correo."); process.exit(1); }
console.log("✓ ningún host local llega a un correo; los dominios reales pasan intactos");
