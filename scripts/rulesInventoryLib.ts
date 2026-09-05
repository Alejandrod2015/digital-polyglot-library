/**
 * Piezas compartidas del inventario maestro de reglas (docs/rules-inventory.json).
 *
 * Las usan tres sitios y por eso viven aparte:
 *   - scripts/buildRulesInventory.ts   siembra y regenera el inventario
 *   - scripts/checkRulesInventory.ts   lint:rules-inventory
 *   - scripts/rulesFor.ts              la puerta que cargan las skills
 *
 * La logica de FANTASMAS (un gate citado que no existe en el arbol) es la
 * misma que la de scripts/checkHardRules.ts, lookbehind incluido: sin el,
 * `src/lib/x.ts` se lee DENTRO de `apps/mobile/src/lib/x.ts` y una ruta del
 * movil pasa por una del web.
 */
import * as fs from "fs";
import * as path from "path";

export const REPO = path.resolve(__dirname, "..");
export const INVENTARIO = path.join(REPO, "docs", "rules-inventory.json");

export type Dominio =
  | "story" | "vocab" | "audio" | "cover" | "journey" | "practice" | "comms" | "process";

export type FilaRegla = {
  id: string;
  domain: Dominio;
  /** Una linea: que exige la regla. */
  rule: string;
  /** Id de check, ruta de script, hook .sh, "process" o "none". */
  gate: string;
  /** De donde sale la fila: memory:<fichero>, story-rules:<id>, validator:<fichero>, CLAUDE.md, manual. */
  source: string;
};

export type Inventario = {
  _why: string;
  _gate: Record<string, string>;
  _generated: string;
  rules: FilaRegla[];
};

/** La memoria del proyecto, con el mismo recorte de worktree que checkHardRules. */
export function dirMemoria(): string {
  if (process.env.DPL_MEMORY_DIR) return process.env.DPL_MEMORY_DIR;
  const principal = REPO.replace(/\/\.claude\/worktrees\/[^/]+$/, "");
  const slug = principal.replace(/\//g, "-");
  return path.join(process.env.HOME ?? "", ".claude", "projects", slug, "memory");
}

/** Ids de check implementados de verdad, por fichero de validador. */
export function checksImplementados(): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const f of ["src/lib/validateGeneratedStory.ts", "src/lib/validateJourneyStories.ts"]) {
    const p = path.join(REPO, f);
    if (!fs.existsSync(p)) continue;
    const txt = fs.readFileSync(p, "utf8");
    const ids = new Set<string>();
    for (const m of txt.matchAll(/id:\s*"([a-z0-9-]+)"/g)) ids.add(m[1]);
    // `push`, `noImpl` y sus variantes de conjunto (`pushSet`, `noImplSet`).
    for (const m of txt.matchAll(/(?:push|noImpl)(?:Set)?\(\s*"([a-z0-9-]+)"/g)) ids.add(m[1]);
    out.set(f, [...ids].sort());
  }
  return out;
}

/** Etiqueta humana de un check, leida del propio validador; si no hay, el id. */
export function etiquetaDeCheck(fichero: string, id: string): string {
  const p = path.join(REPO, fichero);
  if (!fs.existsSync(p)) return id;
  const txt = fs.readFileSync(p, "utf8");
  const porObjeto = new RegExp(`id:\\s*"${id}"\\s*,\\s*label:\\s*"([^"]+)"`).exec(txt);
  if (porObjeto && porObjeto[1].trim()) return porObjeto[1].trim();
  const porLlamada = new RegExp(`(?:push|noImpl)(?:Set)?\\(\\s*"${id}"\\s*,\\s*[\`"]([^\`"]+)[\`"]`).exec(txt);
  if (porLlamada && porLlamada[1].trim()) return porLlamada[1].trim();
  return id;
}

/** npm scripts declarados. */
export function scriptsNpm(): Set<string> {
  const p = path.join(REPO, "package.json");
  if (!fs.existsSync(p)) return new Set();
  return new Set(Object.keys(JSON.parse(fs.readFileSync(p, "utf8")).scripts ?? {}));
}

/** Hooks .sh nombrados en .claude/settings.json o presentes en .claude/safety. */
export function hooksExistentes(): Set<string> {
  const out = new Set<string>();
  const sp = path.join(REPO, ".claude", "settings.json");
  if (fs.existsSync(sp))
    for (const m of fs.readFileSync(sp, "utf8").matchAll(/([a-z0-9-]+\.sh)/g)) out.add(m[1]);
  const dir = path.join(REPO, ".claude", "safety");
  if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir)) if (f.endsWith(".sh")) out.add(f);
  return out;
}

/**
 * Comprueba que un `gate` apunta a algo que EXISTE. Devuelve el motivo del
 * fallo, o null si esta bien. Formas admitidas:
 *
 *   none | process               declaraciones honestas, siempre validas
 *   process + skill /tabla       proceso con una puerta que carga las reglas
 *   scripts/x.ts | src/lib/x.ts  ruta, opcionalmente con #check-id
 *   pre-algo.sh                  hook de .claude/safety o de settings.json
 *   npm run lint:x               script de package.json
 *   check-id                     id implementado en un validador
 */
export function gateFantasma(gate: string): string | null {
  const g = gate.trim();
  if (!g) return "vacio";

  const partes = g.split("+").map((x) => x.trim()).filter(Boolean);
  if (partes.length > 1) {
    for (const p of partes) {
      const mal = gateFantasma(p);
      if (mal) return mal;
    }
    return null;
  }

  if (g === "none" || g === "process") return null;

  const skill = /^skill\s+\/([a-z0-9-]+)$/.exec(g);
  if (skill) {
    const p = path.join(REPO, ".claude", "skills", skill[1], "SKILL.md");
    return fs.existsSync(p) ? null : `la skill /${skill[1]} no existe (${path.relative(REPO, p)})`;
  }

  const npm = /^npm run ([a-z0-9:-]+)$/.exec(g);
  if (npm) return scriptsNpm().has(npm[1]) ? null : `npm run ${npm[1]} no esta en package.json`;

  if (/\.sh$/.test(g)) {
    const hooks = hooksExistentes();
    if (hooks.has(g)) return null;
    return fs.existsSync(path.join(REPO, ".claude", "safety", g)) ? null : `el hook ${g} no existe`;
  }

  const ruta = /^((?:scripts|src\/lib|src\/app|apps\/mobile)\/[A-Za-z0-9_/.-]+\.(?:ts|tsx|py))(?:#([a-z0-9-]+))?$/.exec(g);
  if (ruta) {
    const abs = path.join(REPO, ruta[1]);
    if (!fs.existsSync(abs)) return `${ruta[1]} no esta en el arbol`;
    if (ruta[2]) {
      const txt = fs.readFileSync(abs, "utf8");
      if (!txt.includes(`"${ruta[2]}"`)) return `${ruta[1]} no implementa el check ${ruta[2]}`;
    }
    return null;
  }

  if (/^[a-z][a-z0-9-]+$/.test(g)) {
    for (const ids of checksImplementados().values()) if (ids.includes(g)) return null;
    return `el check ${g} no esta implementado en ningun validador`;
  }

  return `no reconozco la forma del gate "${g}"`;
}

export function leerInventario(): Inventario {
  return JSON.parse(fs.readFileSync(INVENTARIO, "utf8")) as Inventario;
}

export function escribirInventario(inv: Inventario): void {
  const orden = (a: FilaRegla, b: FilaRegla) =>
    a.domain === b.domain ? a.id.localeCompare(b.id) : a.domain.localeCompare(b.domain);
  inv.rules = [...inv.rules].sort(orden);
  fs.writeFileSync(INVENTARIO, JSON.stringify(inv, null, 2) + "\n");
}
