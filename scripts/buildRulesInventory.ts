/**
 * Siembra y regenera docs/rules-inventory.json, el inventario maestro (I1).
 *
 *   npx tsx scripts/buildRulesInventory.ts            (reescribe el inventario)
 *   npx tsx scripts/buildRulesInventory.ts --check    (no escribe; dice si esta al dia)
 *
 * TRES FUENTES, ninguna escrita a mano:
 *
 *   1. Los validadores. Una fila por CHECK implementado en
 *      validateGeneratedStory.ts y validateJourneyStories.ts. Es la direccion
 *      inversa del lint: un check nuevo sin fila deja el inventario desfasado y
 *      lint:rules-inventory lo canta.
 *   2. docs/story-rules.json. Sus 43 filas traen el texto humano de la regla y
 *      la memoria de la que sale; se funden con la fila del check homonimo.
 *   3. La memoria del proyecto y .claude/CLAUDE.md. Cada memoria dura lleva
 *      desde el 2026-09-05 una linea `**Enforcement`; de ahi sale el gate, sin
 *      que nadie tenga que acordarse de la regla. Las secciones BLOQUEANTES de
 *      CLAUDE.md entran igual, por su titulo.
 *
 * Lo escrito A MANO se respeta: toda fila cuyo `source` empiece por "manual"
 * sobrevive a la regeneracion y gana a la fila generada con su mismo id.
 */
import * as fs from "fs";
import * as path from "path";
import {
  REPO, INVENTARIO, type Dominio, type FilaRegla, type Inventario,
  dirMemoria, checksImplementados, etiquetaDeCheck, leerInventario, escribirInventario,
} from "./rulesInventoryLib";

/** Mismo criterio de "dura" que scripts/checkHardRules.ts. */
const DURA =
  /regla dura|hard rule|BLOQUEANTE|\bNUNCA\b|\bNEVER\b|\bJAM[AÁ]S\b|prohibid/i;

/**
 * El dominio sale del nombre y de la descripcion, en este orden: la primera
 * regla que casa manda. El orden importa (una memoria de voces de practica es
 * de audio, no de practica: lo que se juzga es el clip).
 */
const DOMINIOS: Array<[Dominio, RegExp]> = [
  ["cover", /cover|portada|mural|deblush|imagen|image|flux|ilustra/i],
  ["audio", /audio|voice|voz|voces|tts|narrat|narrac|elevenlabs|prosod|entonac|f0\b|sonido|karaoke|mp3|clip|acento|aspiraci/i],
  ["vocab", /vocab|glosa|gloss|lema|lemma|pildora|palabra tocable/i],
  ["practice", /practice|practica|ejercicio|exercise|distractor/i],
  ["comms", /email|correo|mail|beta|comms|anunci|announce|notif|blog|shop|tienda|ads|campa/i],
  ["journey", /journey|topic|tema|placement|nivel|level|cefr-level|catalog/i],
  ["story", /story|storie|historia|narrador|cefr|arco|arc\b|titulo|personaje|acotaci|sinopsis/i],
];

function dominioDe(texto: string): Dominio {
  for (const [d, re] of DOMINIOS) if (re.test(texto)) return d;
  return "process";
}

/** Una linea, sin saltos ni comillas raras, para que la fila se lea de un tiron. */
function unaLinea(s: string, tope = 200): string {
  // Las descripciones de la memoria llevan guiones largos y el inventario vive
  // en docs/, uno de los seis arboles donde el lint los prohibe. Se sustituyen
  // en la fuente que los genera; si no, cada regeneracion bloquea el push. Los
  // caracteres se construyen por codigo a proposito: escribirlos aqui seria
  // romper la misma regla que este renglon respeta.
  const EM = new RegExp(`\\s*${String.fromCharCode(0x2014)}\\s*`, "g");
  const EN = new RegExp(String.fromCharCode(0x2013), "g");
  const t = s.replace(EM, "; ").replace(EN, "-").replace(/\s+/g, " ").trim();
  return t.length > tope ? t.slice(0, tope - 3).trimEnd() + "..." : t;
}

/**
 * De un texto de enforcement al `gate` de la fila.
 *
 * Lo que se busca es lo que puede hacer cumplir la regla, en el orden en que
 * vale: una ruta de script, un hook, un npm run, un id de check. Si no nombra
 * ninguno, la memoria tiene que decir POR QUE, y ahi se separan dos cosas que
 * no son lo mismo: `process` es un paso obligatorio que no se puede codificar,
 * `none` es un hueco conocido que hoy no comprueba nadie.
 */
export function gateDeEnforcement(texto: string, idsCheck: Set<string>): string {
  const rutas = [...texto.matchAll(/(?<![A-Za-z0-9_/.-])((?:scripts|src\/lib)\/[A-Za-z0-9_/-]+\.ts)/g)]
    .map((m) => m[1])
    .filter((r) => fs.existsSync(path.join(REPO, r)));
  if (rutas.length) return rutas[0];

  const hooks = [...texto.matchAll(/((?:pre|post|stop)-[a-z0-9-]+\.sh)/g)].map((m) => m[1]);
  if (hooks.length) return hooks[0];

  const npm = [...texto.matchAll(/npm run ([a-z0-9:-]+)/g)].map((m) => m[1]);
  if (npm.length) return `npm run ${npm[0]}`;

  const checks = [...texto.matchAll(/`([a-z][a-z0-9-]{4,})`/g)].map((m) => m[1]).filter((x) => idsCheck.has(x));
  if (checks.length) return checks[0];
  const sueltos = [...texto.matchAll(/check\s+`?([a-z][a-z0-9-]{4,})`?/gi)].map((m) => m[1]).filter((x) => idsCheck.has(x));
  if (sueltos.length) return sueltos[0];

  if (/no se puede gatear|no es codificable|no se puede comprobar por c[oó]digo|regla de proceso|paso obligatorio|disciplina|criterio de|es metodo|es m[eé]todo/i.test(texto))
    return "process";
  return "none";
}

/** Las lineas del texto donde se habla de hacer cumplir, con la siguiente. */
const ENFORCE =
  /BLOQUEA|bloquea|gate|hook|\bcheck\b|lint|valida|enforce|rechaza|salta el|se comprueba|comprobado por|sin gate|no se puede gatear|no es codificable/i;

function ventanasDeEnforcement(txt: string): string {
  const lineas = txt.split("\n");
  return lineas
    .map((l, k) => `${l}\n${lineas[k + 1] ?? ""}`)
    .filter((v) => ENFORCE.test(v))
    .join("\n");
}

/** Filas de los validadores: una por check implementado. */
function filasDeValidadores(): FilaRegla[] {
  const out: FilaRegla[] = [];
  for (const [fichero, ids] of checksImplementados()) {
    const dominio: Dominio = fichero.endsWith("validateJourneyStories.ts") ? "journey" : "story";
    for (const id of ids) {
      out.push({
        id,
        domain: /^vocab-/.test(id) ? "vocab" : dominio,
        rule: unaLinea(etiquetaDeCheck(fichero, id)),
        gate: `${fichero}#${id}`,
        source: `validator:${fichero}`,
      });
    }
  }
  return out;
}

/** Filas de docs/story-rules.json, que trae el texto humano y la memoria. */
function filasDeStoryRules(): FilaRegla[] {
  const p = path.join(REPO, "docs", "story-rules.json");
  if (!fs.existsSync(p)) return [];
  const doc = JSON.parse(fs.readFileSync(p, "utf8")) as {
    rules: Array<{ id: string; gate: string; check?: string; rule: string; memory?: string; hook?: string }>;
  };
  return doc.rules.map((r) => {
    let gate = r.gate;
    if (r.gate === "story") gate = `src/lib/validateGeneratedStory.ts#${r.check ?? r.id}`;
    else if (r.gate === "journey") gate = `src/lib/validateJourneyStories.ts#${r.check ?? r.id}`;
    else if (r.gate === "hook") gate = r.hook ?? "process";
    return {
      id: r.id,
      domain: /^vocab-/.test(r.id) ? "vocab" : dominioDe(`${r.id} ${r.rule} ${r.memory ?? ""}`),
      rule: unaLinea(r.rule),
      gate,
      source: `story-rules:${r.id}${r.memory ? ` (${r.memory})` : ""}`,
    } as FilaRegla;
  });
}

/** Filas de la memoria: una por memoria DURA, con su linea `**Enforcement`. */
function filasDeMemoria(idsCheck: Set<string>): { filas: FilaRegla[]; duras: number; conLinea: number } {
  const dir = dirMemoria();
  if (!fs.existsSync(dir)) {
    console.error(`rules-inventory: no encuentro la memoria en ${dir}. Apuntala con DPL_MEMORY_DIR.`);
    process.exit(1);
  }
  const filas: FilaRegla[] = [];
  let duras = 0, conLinea = 0;
  for (const f of fs.readdirSync(dir).sort()) {
    if (!f.endsWith(".md") || f === "MEMORY.md") continue;
    const txt = fs.readFileSync(path.join(dir, f), "utf8");
    if (!DURA.test(txt)) continue;
    duras++;
    // La regla es la `description` del frontmatter; si esa memoria no la trae,
    // la primera linea del cuerpo, que es donde se enuncia.
    const cuerpo = txt.replace(/^---[\s\S]*?\n---\n/, "");
    const desc = /^description:\s*(.+)$/m.exec(txt)?.[1]
      ?? cuerpo.split("\n").map((l) => l.trim()).find((l) => l.length > 20)
      ?? f;
    const enf = /\*\*Enforcement[^:]{0,30}:\*\*\s*([^\n]+(?:\n(?!\n)[^\n]+)*)/.exec(txt)?.[1] ?? "";
    if (enf) conLinea++;
    // Sin linea de enforcement se lee el CUERPO, pero solo donde se habla de
    // hacer cumplir: la misma ventana de dos lineas que usa checkHardRules.ts.
    // Leer la memoria entera daria por gate cualquier ruta mencionada de paso,
    // que es justo el falso positivo que ese lint vino a evitar.
    filas.push({
      id: f.replace(/\.md$/, ""),
      domain: dominioDe(`${f} ${desc}`),
      rule: unaLinea(desc),
      gate: gateDeEnforcement(enf || ventanasDeEnforcement(txt), idsCheck),
      source: `memory:${f}`,
    });
  }
  return { filas, duras, conLinea };
}

/**
 * Filas de .claude/CLAUDE.md: sus secciones BLOQUEANTES. El titulo es la regla
 * y el gate sale del cuerpo de la seccion con el mismo lector que la memoria.
 */
function filasDeClaudeMd(idsCheck: Set<string>): FilaRegla[] {
  const p = path.join(REPO, ".claude", "CLAUDE.md");
  if (!fs.existsSync(p)) return [];
  const txt = fs.readFileSync(p, "utf8");
  const secciones = txt.split(/\n(?=## )/);
  const out: FilaRegla[] = [];
  for (const s of secciones) {
    const titulo = /^##\s+(.+)$/m.exec(s)?.[1]?.trim();
    if (!titulo) continue;
    if (!/BLOQUEANTE|BLOCKING|HARD RULE|no bypass|DO NOT BYPASS/i.test(s)) continue;
    const id = "claude-md-" + titulo.toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60);
    out.push({
      id,
      // Solo por el TITULO. Con el cuerpo dentro, una seccion que nombra de
      // paso `rulesFor story vocab journey` se clasificaba de vocab.
      domain: dominioDe(titulo),
      rule: unaLinea(titulo.replace(/\s*\(.*$/, "")),
      gate: gateDeEnforcement(s, idsCheck),
      source: "CLAUDE.md",
    });
  }
  return out;
}

function construir(): { inv: Inventario; stats: Record<string, number> } {
  const idsCheck = new Set<string>();
  for (const ids of checksImplementados().values()) for (const id of ids) idsCheck.add(id);

  const validadores = filasDeValidadores();
  const storyRules = filasDeStoryRules();
  const { filas: memoria, duras, conLinea } = filasDeMemoria(idsCheck);
  const claude = filasDeClaudeMd(idsCheck);

  // Fusion. Gana la fila mas informada: la de story-rules trae texto humano y
  // memoria, la del validador trae el gate exacto. Cuando comparten id se
  // quedan el texto de story-rules y el gate del validador.
  const porId = new Map<string, FilaRegla>();
  for (const f of validadores) porId.set(f.id, f);
  for (const f of storyRules) {
    const previa = porId.get(f.id);
    porId.set(f.id, previa ? { ...f, gate: previa.gate, source: `${f.source} + ${previa.source}` } : f);
  }
  for (const f of [...memoria, ...claude]) if (!porId.has(f.id)) porId.set(f.id, f);

  // Lo manual manda y no se pierde nunca.
  let manuales = 0;
  if (fs.existsSync(INVENTARIO)) {
    for (const f of leerInventario().rules) {
      if (!/^manual/.test(f.source)) continue;
      porId.set(f.id, f);
      manuales++;
    }
  }

  const rules = [...porId.values()];
  const inv: Inventario = {
    _why:
      "Inventario maestro: toda regla dura del proyecto es una fila con su gate declarado " +
      "(o 'process'/'none' explicitos). Existe porque el cumplimiento dependia de que el chat " +
      "RECORDARA las reglas. Se genera con scripts/buildRulesInventory.ts desde tres fuentes " +
      "(los validadores, docs/story-rules.json y las lineas **Enforcement de la memoria mas las " +
      "secciones BLOQUEANTES de .claude/CLAUDE.md) y lo vigila npm run lint:rules-inventory. " +
      "Las filas escritas a mano llevan source 'manual' y sobreviven a la regeneracion.",
    _gate: {
      "<ruta>.ts#<check>": "check implementado en ese validador",
      "<ruta>.ts": "script que hace cumplir la regla",
      "<hook>.sh": "hook PreToolUse de .claude/safety",
      "npm run <lint>": "lint enganchado al manifiesto del pre-push",
      "skill /<nombre>": "puerta que carga las reglas antes de trabajar",
      process: "no es comprobable por codigo: es un paso obligatorio del proceso",
      none: "hueco conocido: hoy no lo comprueba nadie",
    },
    _generated: "scripts/buildRulesInventory.ts",
    rules,
  };
  return {
    inv,
    stats: {
      total: rules.length,
      validadores: validadores.length,
      storyRules: storyRules.length,
      memoriaDuras: duras,
      memoriaConEnforcement: conLinea,
      claudeMd: claude.length,
      manuales,
      sinGate: rules.filter((r) => r.gate === "none").length,
      proceso: rules.filter((r) => r.gate === "process").length,
    },
  };
}

function main() {
  const { inv, stats } = construir();
  const soloCheck = process.argv.includes("--check");
  const antes = fs.existsSync(INVENTARIO) ? fs.readFileSync(INVENTARIO, "utf8") : "";
  escribirInventario(inv);
  const ahora = fs.readFileSync(INVENTARIO, "utf8");
  if (soloCheck) {
    if (antes) fs.writeFileSync(INVENTARIO, antes);
    if (antes !== ahora) {
      console.error("rules-inventory: el inventario NO esta al dia. Regeneralo:");
      console.error("  npx tsx scripts/buildRulesInventory.ts");
      process.exit(1);
    }
    console.log("rules-inventory: al dia");
    return;
  }
  console.log(
    `rules-inventory: ${stats.total} filas ` +
    `(${stats.validadores} de validadores, ${stats.storyRules} de story-rules, ` +
    `${stats.memoriaDuras} memorias duras con ${stats.memoriaConEnforcement} lineas **Enforcement, ` +
    `${stats.claudeMd} secciones de CLAUDE.md, ${stats.manuales} a mano)`
  );
  console.log(`rules-inventory: ${stats.sinGate} sin gate (none) · ${stats.proceso} de proceso`);
}

if (require.main === module) main();
