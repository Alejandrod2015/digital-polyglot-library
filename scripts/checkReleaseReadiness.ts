/**
 * lint:release-readiness
 *
 * Mide, pieza por pieza, cuanto del plan de despliegue por etapas
 * (docs/plan-despliegue-por-etapas.md) esta hecho de verdad, y lo deja en
 * src/data/releaseReadiness.json para que el digest semanal lo lea. La etapa
 * y las piezas viven en src/lib/releaseStage.ts; aqui solo se detecta.
 *
 *   npx tsx scripts/checkReleaseReadiness.ts            (comprueba: falla si el JSON esta desfasado)
 *   npx tsx scripts/checkReleaseReadiness.ts --write    (regenera el JSON)
 *
 * Tres clases de pieza:
 *   auto     se detecta en el repo (una dependencia, una linea de config, un
 *            archivo). Se recalcula en cada push; el JSON commiteado tiene que
 *            coincidir o el push no pasa.
 *   manual   no deja rastro en el repo (Play Console, Vercel, un ensayo de
 *            restauracion). Se marca en scripts/release-readiness-manual.json
 *            con fecha y prueba.
 *   process  disciplina, no estado. No se mide ni se marca.
 *
 * WHY: el plan se escribio el 2026-09-06 y el usuario pregunto, con razon, que
 * pasaba si se olvidaba de el. Un plan en docs/ sin nada que lo empuje se pudre;
 * este lint es lo que lo empuja, y el digest de los lunes es donde asoma.
 */
import * as fs from "fs";
import * as path from "path";
import { RELEASE_STAGES, type ReleaseReadiness } from "../src/lib/releaseStage";

const REPO = path.resolve(__dirname, "..");
const OUT = path.join(REPO, "src", "data", "releaseReadiness.json");
const MANUAL = path.join(REPO, "scripts", "release-readiness-manual.json");

function read(rel: string): string {
  try {
    return fs.readFileSync(path.join(REPO, rel), "utf8");
  } catch {
    return "";
  }
}

function has(rel: string, re: RegExp): boolean {
  return re.test(read(rel));
}

function mobileDep(name: string): boolean {
  try {
    const p = JSON.parse(read("apps/mobile/package.json")) as { dependencies?: Record<string, string> };
    return Boolean(p.dependencies?.[name]);
  } catch {
    return false;
  }
}

function easJson(): Record<string, unknown> {
  try {
    return JSON.parse(read("apps/mobile/eas.json")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function easChannel(profile: string): string {
  const eas = easJson();
  const build = (eas.build ?? {}) as Record<string, Record<string, unknown>>;
  return String(build[profile]?.channel ?? "");
}

function dirHasFiles(rel: string, re: RegExp): boolean {
  try {
    return fs.readdirSync(path.join(REPO, rel)).some((f) => re.test(f));
  } catch {
    return false;
  }
}

/** Todas las rutas de cron importan el guard de entorno. */
function everyCronGuarded(): boolean {
  const dir = path.join(REPO, "src", "app", "api", "cron");
  let routes: string[];
  try {
    routes = fs.readdirSync(dir).map((d) => path.join(dir, d, "route.ts")).filter((f) => fs.existsSync(f));
  } catch {
    return false;
  }
  if (!routes.length) return false;
  if (!fs.existsSync(path.join(REPO, "src", "lib", "cronGuard.ts"))) return false;
  return routes.every((f) => /from "@\/lib\/cronGuard"/.test(fs.readFileSync(f, "utf8")));
}

// Un detector por pieza `auto`. Cada uno mira UN hecho del repo; si el hecho es
// ambiguo, el detector dice false: un falso "hecho" en el digest es peor que un
// falso "pendiente", porque el segundo se ve y el primero no.
const AUTO: Record<string, () => boolean> = {
  "mobile-sentry": () =>
    mobileDep("@sentry/react-native") && has("apps/mobile/App.tsx", /Sentry\.init\(/),
  "mobile-ota": () =>
    mobileDep("expo-updates") &&
    has("apps/mobile/app.config.js", /runtimeVersion:\s*\{\s*policy:\s*"fingerprint"/) &&
    has("apps/mobile/app.config.js", /updates:\s*\{[^}]*url:\s*"https:\/\/u\.expo\.dev\//s),
  "eas-channels": () => easChannel("preview") === "preview" && easChannel("production") === "production",
  "comms-gate-ota": () => has(".claude/safety/pre-comms-claim-guard.sh", /expo-updates/),
  "ci-workflows": () => dirHasFiles(".github/workflows", /\.ya?ml$/),
  "cron-env-guard": everyCronGuarded,
  "ignore-build-branch": () => has("scripts/vercel-ignore-build.sh", /DPL_DEPLOY_BRANCH/),
  // featureFlags.ts existe desde la migracion de Sanity, pero son flags de esa
  // migracion, uno por lote. La pieza pide un mecanismo GENERAL (un flag por
  // nombre que cualquier feature pueda consultar); se detecta por su export.
  "feature-flags": () => has("src/lib/featureFlags.ts", /export function (isFlagOn|flagEnabled)\(/),
  "e2e-money-paths": () =>
    dirHasFiles(".github/workflows", /e2e/) && (fs.existsSync(path.join(REPO, "e2e")) || fs.existsSync(path.join(REPO, ".maestro"))),
  "min-app-version": () => has("apps/mobile/src/config.ts", /MIN_SUPPORTED_APP_VERSION|minSupportedAppVersion/),
  "api-versioning": () => fs.existsSync(path.join(REPO, "src", "app", "api", "v1")),
  "ci-store-submit": () => dirHasFiles(".github/workflows", /submit|release/),
};

type ManualFile = { items: Record<string, { done?: boolean; date?: string; evidence?: string }> };

function manualStatus(): Record<string, boolean> {
  let m: ManualFile;
  try {
    m = JSON.parse(fs.readFileSync(MANUAL, "utf8")) as ManualFile;
  } catch {
    return {};
  }
  const out: Record<string, boolean> = {};
  for (const [id, v] of Object.entries(m.items ?? {})) {
    // Marcar "hecho" exige fecha y una prueba con sustancia; un `true` suelto
    // es la clase de recordatorio que este lint existe para no creerse.
    out[id] =
      v.done === true &&
      /^\d{4}-\d{2}-\d{2}$/.test(v.date ?? "") &&
      (v.evidence ?? "").trim().split(/\s+/).length >= 4;
  }
  return out;
}

function compute(): ReleaseReadiness {
  const manual = manualStatus();
  const status: Record<string, boolean> = {};
  const errores: string[] = [];
  for (const stage of RELEASE_STAGES) {
    for (const it of stage.items) {
      if (it.kind === "process") continue;
      if (it.kind === "auto") {
        const det = AUTO[it.id];
        if (!det) errores.push(`la pieza auto "${it.id}" no tiene detector en checkReleaseReadiness.ts`);
        status[it.id] = det ? det() : false;
      } else {
        if (!(it.id in manual)) errores.push(`la pieza manual "${it.id}" no esta en scripts/release-readiness-manual.json`);
        status[it.id] = manual[it.id] ?? false;
      }
    }
  }
  if (errores.length) {
    for (const e of errores) console.error("release-readiness: " + e);
    process.exit(1);
  }
  return { generatedAt: new Date().toISOString().slice(0, 10), status };
}

function main() {
  const fresh = compute();
  const done = Object.values(fresh.status).filter(Boolean).length;
  const total = Object.keys(fresh.status).length;

  if (process.argv.includes("--write")) {
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify(fresh, null, 2) + "\n");
    console.log(`release-readiness: ${done}/${total} piezas hechas, escrito ${path.relative(REPO, OUT)}`);
    return;
  }

  let stored: ReleaseReadiness | null = null;
  try {
    stored = JSON.parse(fs.readFileSync(OUT, "utf8")) as ReleaseReadiness;
  } catch {
    stored = null;
  }
  const diff = Object.keys(fresh.status).filter((k) => stored?.status?.[k] !== fresh.status[k]);
  const extra = Object.keys(stored?.status ?? {}).filter((k) => !(k in fresh.status));

  if (!stored || diff.length || extra.length) {
    console.error(`release-readiness: ${path.relative(REPO, OUT)} esta desfasado.`);
    for (const k of diff) console.error(`  ${k}: ahora ${fresh.status[k] ? "hecha" : "pendiente"}`);
    for (const k of extra) console.error(`  ${k}: ya no existe como pieza`);
    console.error("  Regeneralo:  npx tsx scripts/checkReleaseReadiness.ts --write");
    process.exit(1);
  }
  console.log(`release-readiness: ${done}/${total} piezas hechas, al dia`);
}

main();
