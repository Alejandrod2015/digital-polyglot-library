/**
 * LINT: no long dashes, em (U+2014) or en (U+2013), anywhere in the repo's own
 * text.
 *
 * WHY: the user's typographic rule is hard (never the character), but the only
 * gate that existed was inside validateGeneratedStory, which covers JourneyStory
 * bodies and nothing else. Everything without a gate drifted: on 2026-08-16 the
 * journey page title rendered "Traveler / Portuguese A0" in the browser tab, the
 * blog carried 69, the source comments 103, scripts 271, docs 197 and the
 * generated preview pages under public/ another 880. The en dash is the same
 * rule ("tampoco el en dash salvo que sea inevitable en datos"): 226 more,
 * mostly label-and-gloss lines in the blog and numeric ranges.
 *
 * Run:  npm run lint:no-emdash        (files, this script)
 *       npm run lint:no-emdash:db     (every text column in the database)
 * Exit: 0 clean, 1 with a file:line list of every occurrence.
 */
import * as fs from "fs";
import * as path from "path";

const ROOTS = ["src", "content", "apps/mobile", "scripts", "docs", "public"];

const SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  ".expo",
  ".git",
  "dist",
  "build",
  // Third-party code we vendor rather than write.
  "vendor",
  "generated",
  ".venv",
  ".venv-chatterbox",
  "__pycache__",
  "whisper-models",
  // Native projects and captured screenshots.
  "ios",
  "android",
  "journey-shots",
]);

const EXT = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".css",
  ".md",
  ".mdx",
  ".html",
  ".py",
  ".sh",
  ".txt",
  ".sql",
  ".yml",
  ".yaml",
]);

/**
 * The allowlist lives in scripts/no-emdash-allowlist.json so that this lint and
 * the PreToolUse hook (.claude/safety/pre-emdash-guard.sh) read the SAME list
 * and cannot drift apart. It is keyed PER CHARACTER: a file that needs the en
 * dash inside a regex is not thereby excused from the em dash. That file
 * explains what earns an entry.
 */
type Allow = { prefixes: string[]; files: string[] };
const allowlist = JSON.parse(
  fs.readFileSync(path.join(__dirname, "no-emdash-allowlist.json"), "utf8")
) as { em: Allow; en: Allow };

const DASHES = [
  { char: "—", key: "em" as const, name: "em dash" },
  { char: "–", key: "en" as const, name: "en dash" },
];

type Hit = { file: string; line: number; dash: string; text: string };

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

function isAllowed(file: string, key: "em" | "en"): boolean {
  const rel = file.split(path.sep).join("/");
  const a = allowlist[key];
  return a.files.includes(rel) || a.prefixes.some((p) => rel.startsWith(p));
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
    for (const d of DASHES) {
      if (!content.includes(d.char)) continue;
      if (isAllowed(file, d.key)) continue;
      content.split("\n").forEach((line, i) => {
        if (line.includes(d.char)) {
          hits.push({ file, line: i + 1, dash: d.name, text: line.trim().slice(0, 140) });
        }
      });
    }
  }

  if (hits.length === 0) {
    console.log(`no-dash: limpio (${files.length} archivos revisados, em y en dash)`);
    return;
  }

  hits.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
  const fileCount = new Set(hits.map((h) => h.file)).size;
  console.error(`no-dash: ${hits.length} guiones largos en ${fileCount} archivos\n`);
  for (const h of hits) console.error(`  ${h.file}:${h.line}  [${h.dash}]  ${h.text}`);
  console.error(
    "\nEm dash: sustituye por ';', ':', paréntesis, o corta la oración en dos.\n" +
      "En dash: en un rango ('10-20', 'sep-oct') usa el guion normal; entre una\n" +
      "etiqueta y su glosa, ':'.\n" +
      "Celda vacía de tabla: '-'.\n" +
      "Si el carácter es imprescindible (código que lo busca), añade el archivo a\n" +
      "scripts/no-emdash-allowlist.json bajo 'em' o 'en' y escribe el porqué."
  );
  process.exitCode = 1;
}

main();
