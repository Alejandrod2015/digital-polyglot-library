/**
 * LINT: no emoji glyphs in the UI.
 *
 * WHY: the rule ("nunca emojis en la UI, iconos SVG monocromos") lived in
 * memory with no gate, which is how a rule drifts. Same shape as the long-dash
 * lint so both are read and fixed the same way.
 *
 * SCOPE is deliberately narrower than "every emoji in the tree". What the rule
 * protects is what a USER SEES, so lines that cannot reach the screen are not
 * hits: comments, and console/logger calls, which are developer output. A glyph
 * inside a JSX label or a user-facing string is a hit.
 *
 * Flags (regional indicator pairs) are exempt everywhere: the country flag on a
 * journey is a deliberate design element, not decoration.
 *
 * Es un TRINQUETE, no un barrido: al escribirlo el repo ya arrastraba 144
 * lineas en 47 archivos, y un lint rojo desde el minuto cero se ignora o
 * bloquea todo push. La linea base vive en scripts/no-emojis-baseline.json y
 * guarda cuantas lleva cada archivo. Anadir un emoji falla; quitar uno pide
 * apretar el trinquete. Asi la deuda vieja no bloquea y la nueva es imposible.
 *
 * Run:  npm run lint:no-emojis
 *       npm run lint:no-emojis -- --apretar   (baja la linea base a lo actual)
 * Exit: 0 si nadie ha subido, 1 si algun archivo lleva mas que su linea base.
 */
import * as fs from "fs";
import * as path from "path";

const ROOTS = ["src", "apps/mobile"];

const SKIP_DIRS = new Set([
  "node_modules", ".next", ".expo", ".git", "dist", "build",
  "vendor", "generated", ".venv", "__pycache__",
  "ios", "android", "Pods", "journey-shots",
]);

const EXT = new Set([".ts", ".tsx", ".js", ".jsx"]);

/**
 * Pictographic ranges only. Arrows, checkmarks and box glyphs are typography,
 * not emoji, and the project uses them in comments and diagrams.
 */
const EMOJI =
  /[\u{1F300}-\u{1FAFF}\u{1F000}-\u{1F2FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/gu;
/** Regional indicators: country flags, exempt by design. */
const FLAG = /[\u{1F1E6}-\u{1F1FF}]/u;

type Allow = { prefixes: string[]; files: string[] };
const allowlist = JSON.parse(
  fs.readFileSync(path.join(__dirname, "no-emojis-allowlist.json"), "utf8")
) as Allow;

type Hit = { file: string; line: number; glyphs: string; text: string };

const BASELINE = path.join(__dirname, "no-emojis-baseline.json");

function leerBase(): Record<string, number> {
  try {
    return JSON.parse(fs.readFileSync(BASELINE, "utf8")) as Record<string, number>;
  } catch {
    return {};
  }
}

function walk(dir: string, out: string[]): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      walk(path.join(dir, e.name), out);
    } else if (EXT.has(path.extname(e.name))) {
      out.push(path.join(dir, e.name));
    }
  }
}

function isAllowed(file: string): boolean {
  const rel = file.split(path.sep).join("/");
  return (
    allowlist.files.includes(rel) ||
    allowlist.prefixes.some((p) => rel.startsWith(p))
  );
}

/** A line that cannot reach the screen: a comment, or developer log output. */
function noLlegaAPantalla(line: string): boolean {
  const t = line.trim();
  if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) return true;
  return /\b(console|logger)\s*\.\s*\w+\s*\(/.test(line);
}

function main(): void {
  const files: string[] = [];
  for (const root of ROOTS) walk(root, files);

  const hits: Hit[] = [];
  for (const file of files) {
    let content: string;
    try {
      content = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    if (!EMOJI.test(content)) continue;
    EMOJI.lastIndex = 0;
    if (isAllowed(file)) continue;
    content.split("\n").forEach((line, i) => {
      if (noLlegaAPantalla(line)) return;
      const found = (line.match(EMOJI) || []).filter((g) => !FLAG.test(g));
      if (!found.length) return;
      hits.push({
        file,
        line: i + 1,
        glyphs: [...new Set(found)].join(""),
        text: line.trim().slice(0, 120),
      });
    });
  }

  const porArchivo: Record<string, number> = {};
  for (const h of hits) porArchivo[h.file] = (porArchivo[h.file] ?? 0) + 1;

  if (process.argv.includes("--apretar")) {
    fs.writeFileSync(BASELINE, JSON.stringify(porArchivo, null, 2) + "\n");
    const total = Object.values(porArchivo).reduce((a, b) => a + b, 0);
    console.log(`no-emojis: linea base apretada a ${total} lineas en ${Object.keys(porArchivo).length} archivos.`);
    return;
  }

  const base = leerBase();
  const subidas = Object.entries(porArchivo).filter(
    ([f, n]) => n > (base[f] ?? 0)
  );
  const bajadas = Object.entries(base).filter(
    ([f, n]) => (porArchivo[f] ?? 0) < n
  );

  const total = Object.values(porArchivo).reduce((a, b) => a + b, 0);
  const totalBase = Object.values(base).reduce((a, b) => a + b, 0);

  if (subidas.length === 0) {
    console.log(
      `no-emojis: nadie ha subido (${total} lineas de deuda vieja, linea base ${totalBase}).`
    );
    if (bajadas.length) {
      console.log(
        `no-emojis: ${bajadas.length} archivo(s) con menos que antes. Aprieta el trinquete:\n` +
          "  npm run lint:no-emojis -- --apretar"
      );
    }
    return;
  }

  console.error(`no-emojis: emoji NUEVO en ${subidas.length} archivo(s)\n`);
  for (const [f, n] of subidas) {
    console.error(`  ${f}: ${n} lineas, la linea base era ${base[f] ?? 0}`);
    for (const h of hits.filter((x) => x.file === f)) {
      console.error(`     ${h.line}  ${h.glyphs}  ${h.text}`);
    }
  }
  console.error(
    "\nEl proyecto usa iconos SVG monocromos, nunca un glifo emoji en un boton,\n" +
      "etiqueta o texto de la interfaz (web, Studio y movil por igual).\n" +
      "Escribe el icono SVG que toque y reusa IconButton, o reusa uno que ya exista.\n" +
      "Las banderas de pais estan exentas (son diseno, no decoracion).\n" +
      "Si un archivo necesita el glifo de verdad, anadelo a\n" +
      "scripts/no-emojis-allowlist.json con el porque."
  );
  process.exitCode = 1;
}

main();
