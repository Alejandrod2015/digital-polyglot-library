// Comprueba que el correo de aceptación no le da instrucciones de Apple a un
// tester de Android, que era el fallo. No envía nada.
//   npx tsx scripts/_checkAcceptedEmail.ts
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { mkdirSync, writeFileSync } from "fs";
import { BETA_EMAIL_BUILDERS, type BetaEmailData } from "../src/lib/emails/beta";

const OUT = "scratchpad/accepted-email";

const BASE: BetaEmailData = {
  baseUrl: "https://www.digitalpolyglot.com",
  firstName: "Kelly",
  targetLanguage: "French",
  testflightUrl: "https://testflight.apple.com/join/XXXX",
  unsubscribeToken: "sample",
};

const CASOS: Array<{ nombre: string; data: BetaEmailData; prohibido: RegExp[] }> = [
  {
    nombre: "iOS",
    data: { ...BASE, platform: "ios" },
    // Un tester de iPhone no debe ver nada de Google.
    prohibido: [/Google Play/i, /opt-in/i, /Become a tester/i],
  },
  {
    nombre: "Android con enlaces",
    data: {
      ...BASE,
      platform: "android",
      playOptInUrl: "https://play.google.com/apps/testing/com.digitalpolyglot",
      playGroupJoinUrl: "https://groups.google.com/g/dp-testers",
    },
    // Y uno de Android no debe ver nada de Apple.
    prohibido: [/TestFlight/i, /Apple/i, /App Store/i],
  },
  {
    nombre: "Android sin enlaces todavía",
    data: { ...BASE, platform: "android" },
    prohibido: [/TestFlight/i, /Apple/i, /Become a tester/i],
  },
];

function visible(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");
}

mkdirSync(OUT, { recursive: true });
let fallos = 0;
for (const c of CASOS) {
  const built = BETA_EMAIL_BUILDERS.accepted(c.data);
  writeFileSync(`${OUT}/${c.nombre.replace(/\s+/g, "-")}.html`, built.html ?? "");
  // Sólo lo que el lector ve, más la versión de texto. El HTML crudo NO se
  // mira en bloque: su pila de fuentes lleva `-apple-system` y disparaba un
  // falso positivo de "Apple" en los correos de Android.
  const cuerpo = `${built.subject} ${visible(built.html ?? "")} ${built.text ?? ""}`;
  // Los enlaces sí importan aparte: un botón a apple.com en un correo de
  // Android está tan roto como la frase que lo acompaña.
  const hrefs = Array.from((built.html ?? "").matchAll(/href="([^"]+)"/g)).map((m) => m[1]);
  const malos = [
    ...c.prohibido.filter((re) => re.test(cuerpo)),
    ...(c.nombre.startsWith("Android") && hrefs.some((h) => /apple\.com|testflight/i.test(h))
      ? [/enlace a Apple/]
      : []),
    ...(c.nombre === "iOS" && hrefs.some((h) => /play\.google|groups\.google/i.test(h))
      ? [/enlace a Google/]
      : []),
  ];
  if (malos.length) {
    fallos += 1;
    console.log(`✗ ${c.nombre}: contiene ${malos.map(String).join(", ")}`);
  } else {
    console.log(`✓ ${c.nombre}`);
  }
  console.log(`   asunto: ${built.subject}`);
}
console.log(fallos === 0 ? "\n✓ ninguna instrucción de la tienda equivocada" : `\n✗ ${fallos} casos`);
