// Renderiza a disco los correos del ciclo de vida SIN enviar nada, y comprueba
// que ninguno inventa cifras cuando faltan los datos reales.
//   npx tsx scripts/_renderLifecycleEmails.ts
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { writeFileSync, mkdirSync } from "fs";
import {
  LIFECYCLE_BUILDERS,
  type LifecycleKind,
  type LifecycleData,
} from "../src/lib/emails/lifecycle";

const OUT = "scratchpad/lifecycle-emails";

/** Quita etiquetas y estilos: sólo lo que el lector ve de verdad. */
function visible(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Afirmaciones de demostración que NUNCA deben llegar a un lector real. */
const DEMO: Array<{ re: RegExp; what: string }> = [
  { re: /\b47\b/, what: "47 palabras (demo)" },
  { re: /\b128\b/, what: "128 palabras (demo)" },
  { re: /\bguajolote\b/i, what: "vocabulario semanal de demo" },
  { re: /\bcansada\b/i, what: "vocabulario semanal de demo" },
  { re: /of 7 days active/, what: "gráfico semanal inventado" },
];

/** Caso peor: usuario del que no sabemos absolutamente nada. */
const SIN_DATOS: LifecycleData = {};

/** Usuario real con actividad medida. */
const CON_DATOS: LifecycleData = {
  stats: {
    wordsSeen: 12,
    storiesCount: 2,
    wordsCount: 31,
    daysActive: 3,
    weekDays: [true, false, true, false, false, true, false],
    weekWords: ["madrugar", "chévere", "guayabo"],
  },
};

function render(label: string, data: LifecycleData, check: boolean) {
  console.log(`\n═══ ${label} ═══`);
  mkdirSync(`${OUT}/${label}`, { recursive: true });
  let leaks = 0;
  for (const kind of Object.keys(LIFECYCLE_BUILDERS) as LifecycleKind[]) {
    const built = LIFECYCLE_BUILDERS[kind](data);
    const body = `${built.subject}\n${visible(built.html ?? "")}\n${built.text ?? ""}`;
    writeFileSync(`${OUT}/${label}/${kind}.html`, built.html ?? "");
    const hits = check ? DEMO.filter((d) => d.re.test(body)) : [];
    leaks += hits.length;
    const flag = hits.length ? `  ⚠ ${hits.map((h) => h.what).join(", ")}` : "";
    console.log(`  ${kind.padEnd(14)} ${built.subject}${flag}`);
  }
  if (check) {
    console.log(leaks === 0 ? "  ✓ sin cifras inventadas" : `  ✗ ${leaks} filtraciones`);
  }
}

render("sin-datos", SIN_DATOS, true);
render("con-datos", CON_DATOS, false);
