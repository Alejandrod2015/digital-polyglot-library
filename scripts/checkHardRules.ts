/**
 * lint:hard-rules
 *
 * Una regla que se declara DURA en la memoria del proyecto tiene que decir
 * quien la hace cumplir. No exige que exista un gate: exige que la memoria
 * sea HONESTA sobre si lo hay. Dos salidas validas y ninguna mas:
 *
 *   a) nombra un artefacto de enforcement que EXISTE (un id de check de los
 *      validadores, un hook registrado en .claude/settings.json, o un script
 *      de npm), o
 *   b) declara por escrito que no tiene gate ("sin gate", "solo avisa",
 *      "no se puede gatear"...).
 *
 * Lo que falla es el SILENCIO: una memoria que se llama dura, no nombra a
 * nadie, y no admite que no hay nadie. Ese fue el caso de "nativos de la
 * variante", que llevaba meses declarada dura, sin gate y sin decirlo en el
 * sitio donde se lee la regla; el 2026-09-01 se escribieron 21 historias
 * contra ella sin que saltara nada.
 *
 * Tambien falla nombrar un gate que NO existe, que es peor que no nombrarlo:
 * la memoria promete una red que no esta.
 */
import * as fs from "fs";
import * as path from "path";

const REPO = path.resolve(__dirname, "..");

function dirMemoria(): string {
  if (process.env.DPL_MEMORY_DIR) return process.env.DPL_MEMORY_DIR;
  // Desde un worktree, REPO es <repo>/.claude/worktrees/<nombre>; la memoria
  // vive bajo el slug del repo PRINCIPAL, asi que se recorta el sufijo. Sin
  // esto el lint no encuentra nada y pasa en vacio, que es justo lo que vino
  // a impedir.
  const principal = REPO.replace(/\/\.claude\/worktrees\/[^/]+$/, "");
  const slug = principal.replace(/\//g, "-");
  return path.join(
    process.env.HOME ?? "", ".claude", "projects", slug, "memory"
  );
}

const DURA = /regla dura|REGLA DURA|hard rule|BLOQUEANTE/i;
const ADMITE_SIN_GATE =
  /sin gate|no hay gate|solo avisa|hoy solo avisa|todav[ií]a no hay gate|no se puede gatear|sin gate propio|regla de plan|no es codificable/i;

/** Todo lo que puede hacer cumplir una regla, leido del repo de verdad. */
function artefactos() {
  const ids = new Set<string>();
  for (const f of ["src/lib/validateGeneratedStory.ts", "src/lib/validateJourneyStories.ts"]) {
    const p = path.join(REPO, f);
    if (!fs.existsSync(p)) continue;
    for (const m of fs.readFileSync(p, "utf8").matchAll(/id:\s*"([a-z0-9-]+)"/g)) ids.add(m[1]);
  }
  const hooks = new Set<string>();
  const sp = path.join(REPO, ".claude", "settings.json");
  if (fs.existsSync(sp)) {
    const raw = fs.readFileSync(sp, "utf8");
    for (const m of raw.matchAll(/([a-z0-9-]+\.sh)/g)) hooks.add(m[1]);
  }
  const scripts = new Set<string>();
  const pk = path.join(REPO, "package.json");
  if (fs.existsSync(pk)) {
    for (const k of Object.keys(JSON.parse(fs.readFileSync(pk, "utf8")).scripts ?? {})) scripts.add(k);
  }
  const funcs = new Set<string>();
  for (const f of fs.existsSync(path.join(REPO, "src/lib")) ? fs.readdirSync(path.join(REPO, "src/lib")) : []) {
    if (f.endsWith(".ts")) funcs.add(f.replace(/\.ts$/, ""));
  }
  return { ids, hooks, scripts, funcs };
}

type Fallo = { fichero: string; motivo: string; detalle?: string };

function main() {
  const dir = dirMemoria();
  if (!fs.existsSync(dir)) {
    // Pasar en vacio es el fallo que este lint vino a impedir: si no encuentra
    // la memoria, es un error, no un visto bueno.
    console.error(`hard-rules: no encuentro la memoria en ${dir}.`);
    console.error("Apuntala con DPL_MEMORY_DIR si vive en otro sitio.");
    process.exitCode = 1;
    return;
  }
  const { ids, hooks, scripts, funcs } = artefactos();
  const fallos: Fallo[] = [];
  let duras = 0, conGate = 0, admitidas = 0;

  for (const f of fs.readdirSync(dir).sort()) {
    if (!f.endsWith(".md") || f === "MEMORY.md") continue;
    const txt = fs.readFileSync(path.join(dir, f), "utf8");
    if (!DURA.test(txt)) continue;
    duras++;

    // Lo que la memoria dice que la hace cumplir.
    //
    // No basta con que el nombre APAREZCA: tiene que aparecer donde se habla
    // de hacer cumplir. `project_journey_structure_plan` menciona
    // `src/lib/journeyType.ts` como sitio donde vive un dato, y con la version
    // ingenua de este lint eso la daba por cubierta, que es justo la regla que
    // el lint existe para cazar. Se mira la linea y la siguiente.
    const ENFORCE = /BLOQUEA|bloquea|gate|hook|\bcheck\b|lint|valida|enforce|rechaza|salta el|se comprueba|comprobado por/i;
    const lineas = txt.split("\n");
    const ventanas = lineas
      .map((l, k) => `${l}\n${lineas[k + 1] ?? ""}`)
      .filter((v) => ENFORCE.test(v))
      .join("\n");

    const citados = {
      ids: [...ventanas.matchAll(/`([a-z][a-z0-9-]{4,})`/g)].map((m) => m[1]).filter((x) => ids.has(x)),
      hooks: [...ventanas.matchAll(/((?:pre|post|stop)-[a-z0-9-]+\.sh)/g)].map((m) => m[1]),
      scripts: [...ventanas.matchAll(/npm run ([a-z0-9:-]+)/g)].map((m) => m[1]),
      funcs: [...ventanas.matchAll(/`?(validate[A-Za-z]+|assert[A-Za-z]+)`?/g)].map((m) => m[1]),
      // OJO: aqui se FILTRA por existencia solo para no contarla como red
      // valida. La ruta que no existe se denuncia abajo, en `fantasmas`: antes
      // desaparecia en este filter y la memoria pasaba como si tuviera gate.
      rutas: [...ventanas.matchAll(/((?:scripts|src\/lib)\/[A-Za-z0-9_\/-]+\.ts)/g)]
        .map((m) => m[1]).filter((r) => fs.existsSync(path.join(REPO, r))),
    };

    // Lo citado tiene que EXISTIR. Prometer una red que no esta es peor que
    // no prometer nada.
    const fantasmas = [
      ...[...txt.matchAll(/((?:pre|post|stop)-[a-z0-9-]+\.sh)/g)].map((m) => m[1])
        .filter((h) => !hooks.has(h) && !fs.existsSync(path.join(REPO, ".claude", "safety", h))),
      ...[...txt.matchAll(/npm run ([a-z0-9:-]+)/g)].map((m) => m[1]).filter((x) => !scripts.has(x)),
      // Un .ts citado como red tiene que estar en el arbol. Este hueco es el
      // que dejo pasar `feedback_gloss_in_context`, que nombraba
      // `scripts/reviewCopiedGlosses.ts` y su gate `citaAjena`: los dos viven
      // en una rama de agosto que nunca se fusiono, asi que la memoria
      // prometia una red que aqui no existe y el lint decia "limpio".
      ...[...txt.matchAll(/((?:scripts|src\/lib)\/[A-Za-z0-9_\/-]+\.ts)/g)].map((m) => m[1])
        .filter((r) => !fs.existsSync(path.join(REPO, r))),
    ];
    if (fantasmas.length) {
      fallos.push({ fichero: f, motivo: "nombra enforcement que NO existe", detalle: fantasmas.join(", ") });
      continue;
    }

    const tieneAlguno =
      citados.ids.length > 0 || citados.hooks.length > 0 ||
      citados.scripts.length > 0 || citados.funcs.length > 0 ||
      citados.rutas.length > 0;

    if (tieneAlguno) { conGate++; continue; }
    if (ADMITE_SIN_GATE.test(txt)) { admitidas++; continue; }

    fallos.push({
      fichero: f,
      motivo: "se declara DURA y no dice quien la hace cumplir",
      detalle: "nombra un check, un hook o un script que exista, o escribe en la memoria que no tiene gate",
    });
  }

  console.log(`hard-rules: ${duras} memorias con regla dura · ${conGate} nombran enforcement · ${admitidas} admiten no tenerlo`);
  if (!fallos.length) { console.log("hard-rules: limpio"); return; }
  console.error(`\nhard-rules: ${fallos.length} sin resolver\n`);
  for (const x of fallos) {
    console.error(`  ${x.fichero}`);
    console.error(`    ${x.motivo}`);
    if (x.detalle) console.error(`    ${x.detalle}`);
  }
  process.exit(1);
}

main();
