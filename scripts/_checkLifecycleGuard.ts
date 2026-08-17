// Comprueba que ningún correo que afirma algo sobre el usuario pueda salir
// sin el dato real que lo respalda. No envía nada.
//   npx tsx scripts/_checkLifecycleGuard.ts
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { LIFECYCLE_BUILDERS, hasRealDataFor, type LifecycleKind, type LifecycleData } from "../src/lib/emails/lifecycle";

const STORY = {
  id: "el-mercado-de-medellin",
  title: "El mercado de Medellín",
  coverUrl: "https://example.com/c.png",
  teaser: "El aguacate está a mil pesos.",
  percentRead: 42,
  minutesLeft: 3,
  vocab: [{ word: "regatear", definition: "to haggle" }],
};
const STATS = { wordsSeen: 9, storiesCount: 1, wordsCount: 9, daysActive: 2, weekDays: [true, false, false, true, false, false, false] };

const PERFILES: Array<{ nombre: string; data: LifecycleData }> = [
  { nombre: "no sabemos nada", data: {} },
  { nombre: "solo cifras", data: { stats: STATS } },
  { nombre: "solo su historia", data: { firstStory: STORY } },
  { nombre: "completo", data: { firstStory: STORY, stats: STATS } },
];

// Frases del contenido de demostración que jamás deben llegar a un lector.
const FICCION = [/Jueves con doña Luz/i, /\bmole\b/i, /\bguajolote\b/i, /\b47\b/, /\b128\b/, /38% read/];

// welcome, next y winSunset están exentos a propósito: no afirman nada sobre el
// pasado del usuario. welcome RECOMIENDA una primera historia y enseña una frase
// de muestra para explicar cómo funciona tocar una palabra; next sugiere qué leer
// después; winSunset no menciona ni historia ni cifras. Ahí el contenido de
// ejemplo es el producto, no una mentira.
const EXENTOS = new Set(["welcome", "next", "winSunset"]);

function visible(html: string): string {
  return html.replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}

let fallos = 0;
for (const perfil of PERFILES) {
  const enviables: string[] = [];
  for (const kind of Object.keys(LIFECYCLE_BUILDERS) as LifecycleKind[]) {
    if (!hasRealDataFor(kind, perfil.data)) continue;
    enviables.push(kind);
    if (EXENTOS.has(kind)) continue;
    const built = LIFECYCLE_BUILDERS[kind](perfil.data);
    const body = `${built.subject} ${visible(built.html ?? "")} ${built.text ?? ""}`;
    const inventado = FICCION.filter((re) => re.test(body));
    if (inventado.length) {
      fallos += 1;
      console.log(`  ✗ ${perfil.nombre} → ${kind} contiene: ${inventado.map(String).join(", ")}`);
    }
  }
  console.log(`${perfil.nombre.padEnd(18)} envía: ${enviables.join(", ") || "(ninguno)"}`);
}
console.log(fallos === 0 ? "\n✓ ningún correo enviable contiene contenido inventado" : `\n✗ ${fallos} fallos`);
