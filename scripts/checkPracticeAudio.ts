/**
 * CONTRATO DE LOS SONIDOS DE PRÁCTICA. Falla = alguien rompió algo que sonaba
 * bien.
 *
 * ── Por qué existe este fichero ──────────────────────────────────────────
 *
 * El 2026-08-06/07 se perdió una noche entera persiguiendo un sonido que "ya
 * no sonaba". No era la sesión de audio, ni el preload, ni iOS. Era que la app
 * cargaba un FICHERO DISTINTO al de la web, porque existían dos carpetas
 * (`assets/sfx/` y `assets/sounds/`) con nombres casi idénticos y contenidos
 * distintos. Tres arreglos seguidos fueron técnicamente correctos y del todo
 * irrelevantes. Encima, por una hipótesis nunca comprobada, se desactivó una
 * precarga que sí funcionaba, y eso reintrodujo un retraso ya resuelto.
 *
 * La lección no es "ten cuidado": es que un contrato que solo vive en la
 * cabeza de alguien se rompe en el siguiente cambio. Esto lo pone en código.
 *
 * ── Qué protege ──────────────────────────────────────────────────────────
 *
 *  1. Los CINCO ficheros, por CONTENIDO (sha256), no por nombre. Sustituir el
 *     mp3 dejando el nombre es exactamente lo que pasó y el nombre no lo
 *     detecta.
 *  2. Que app y web usen los MISMOS BYTES. La divergencia entre las dos fue la
 *     causa raíz.
 *  3. Que `assets/sfx/` siga sin existir. Es la carpeta que creó la ambigüedad.
 *  4. Que cada sonido siga enchufado a SU momento, en la app y en la web.
 *  5. Que la precarga siga activa: es lo que mantiene el sonido pegado a la
 *     animación (27 ms medidos en un Pixel 6a, nueve disparos, 2026-08-07).
 *
 * ── Cómo se usa ──────────────────────────────────────────────────────────
 *
 *   npx tsx scripts/checkPracticeAudio.ts
 *
 * Lo dispara solo el hook PostToolUse `.claude/safety/post-audio-contract.sh`
 * cuando se toca cualquier fichero implicado, así que romperlo se ve en el
 * momento y no tres semanas después en un teléfono.
 *
 * ── Cambiar el contrato A PROPÓSITO ──────────────────────────────────────
 *
 * Es legítimo: los sonidos son del usuario y él los reasigna cuando quiera.
 * Para eso se actualizan las constantes de aquí abajo EN EL MISMO CAMBIO. Lo
 * que este fichero impide no es cambiar, es cambiar SIN ENTERARSE.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..");

/** Asignación fijada de oído por el usuario el 2026-08-07. No inventar. */
const SOUNDS = [
  {
    file: "practice-correct.mp3",
    sha: "182403a07ebc02c0",
    moment: "cada acierto",
  },
  {
    file: "practice-wrong.mp3",
    sha: "7533a3d00d0bfa45",
    moment: "cada fallo",
  },
  {
    file: "practice-combo.mp3",
    sha: "f9ad8bc90064e387",
    moment: "2+ aciertos seguidos (sustituye al de acierto)",
  },
  {
    file: "practice-ring-fill.mp3",
    sha: "1bf7c81bd73b1a48",
    moment: "fin de sesión con >=50%, bajo la rueda",
  },
  {
    file: "practice-perfect.mp3",
    sha: "bcd431fb1c984961",
    moment: "fin de sesión con marcador perfecto",
  },
] as const;

const MOBILE_DIR = "apps/mobile/assets/sounds";
const WEB_DIR = "public/sounds";
const SHELL = "apps/mobile/src/mobile/MobileLibraryShell.tsx";
const WEB_PAGE = "src/app/practice/page.tsx";

const failures: string[] = [];

function fail(what: string, why: string) {
  failures.push(`${what}\n     ${why}`);
}

function sha16(absolute: string): string | null {
  if (!existsSync(absolute)) return null;
  return createHash("sha256").update(readFileSync(absolute)).digest("hex").slice(0, 16);
}

// (1) y (2): los cinco ficheros, por contenido, iguales en app y web.
for (const sound of SOUNDS) {
  const mobile = sha16(path.join(ROOT, MOBILE_DIR, sound.file));
  const web = sha16(path.join(ROOT, WEB_DIR, sound.file));

  if (!mobile) {
    fail(`falta ${MOBILE_DIR}/${sound.file}`, `es el sonido de: ${sound.moment}`);
  } else if (mobile !== sound.sha) {
    fail(
      `${sound.file} CAMBIÓ DE CONTENIDO en la app`,
      `esperaba ${sound.sha}, hay ${mobile}. Si el cambio es a propósito, ` +
        `actualiza el sha en scripts/checkPracticeAudio.ts en este mismo commit.`
    );
  }

  if (!web) {
    fail(`falta ${WEB_DIR}/${sound.file}`, "la web sirve su propia copia");
  } else if (mobile && web !== mobile) {
    fail(
      `${sound.file} NO coincide entre app y web`,
      `app ${mobile} vs web ${web}. Esta divergencia exacta costó una noche entera.`
    );
  }
}

// (3): la carpeta ambigua no vuelve.
if (existsSync(path.join(ROOT, "apps/mobile/assets/sfx"))) {
  fail(
    "ha reaparecido apps/mobile/assets/sfx/",
    "dos carpetas con nombres casi iguales fue LA causa del bug. Un solo sitio: assets/sounds/."
  );
}

// (4): cada sonido, enchufado a su momento.
const shell = existsSync(path.join(ROOT, SHELL))
  ? readFileSync(path.join(ROOT, SHELL), "utf8")
  : "";
if (!shell) {
  fail(`no se puede leer ${SHELL}`, "¿se ha movido el shell del móvil?");
} else {
  const wiring: Array<[RegExp, string]> = [
    [/SFX_PRACTICE_CORRECT = require\("\.\.\/\.\.\/assets\/sounds\/practice-correct\.mp3"\)/, "el acierto"],
    [/SFX_PRACTICE_WRONG = require\("\.\.\/\.\.\/assets\/sounds\/practice-wrong\.mp3"\)/, "el fallo"],
    [/SFX_PRACTICE_COMBO = require\("\.\.\/\.\.\/assets\/sounds\/practice-combo\.mp3"\)/, "la racha"],
    [/SFX_PRACTICE_RING_FILL = require\("\.\.\/\.\.\/assets\/sounds\/practice-ring-fill\.mp3"\)/, "la rueda del final"],
    [/SFX_PRACTICE_PERFECT = require\("\.\.\/\.\.\/assets\/sounds\/practice-perfect\.mp3"\)/, "la sesión perfecta"],
  ];
  for (const [pattern, label] of wiring) {
    if (!pattern.test(shell)) {
      fail(`${label} ya no apunta a su fichero en la app`, `no encaja: ${pattern.source}`);
    }
  }

  // El combo tiene que SUSTITUIR al acierto, no sonar encima.
  if (!/playPracticeFeedbackSound\(\s*correct: boolean,\s*combo = false\s*\)/.test(shell)) {
    fail(
      "el sonido de racha ya no pasa por el SFX de respuesta",
      "debe SUSTITUIR al de acierto ahí dentro. Encadenarlo lo deja 1,4 s por detrás; superponerlo es ruido."
    );
  }

  // (5): la precarga, que es lo que pega el sonido a la animación.
  if (/if \(true\) return;/.test(shell)) {
    fail(
      "hay una precarga DESACTIVADA con `if (true) return;`",
      "eso es lo que se desactivó por una hipótesis falsa y devolvió el retraso. " +
        "Medido con precarga: 27 ms de media (Pixel 6a, 9 disparos). Sin ella, tres saltos nativos por respuesta."
    );
  }
  if (!/for \(const slot of \["correct", "wrong", "combo"\] as const\)/.test(shell)) {
    fail(
      "la precarga ya no cubre los tres sonidos de respuesta",
      "si falta uno, ESE llega tarde y los otros no: un retraso intermitente es peor que uno constante."
    );
  }

  // Perfecto y rueda son excluyentes: nunca dos sonidos a la vez.
  if (!/playPracticeRingFillSound\(\)/.test(shell)) {
    fail("no queda quien toque el sonido de la rueda", "debería sonar al cerrar con >=50% y sin marcador perfecto");
  }
}

// (4-bis): la web, que tuvo el mismo fallo y se arregló a la vez.
const web = existsSync(path.join(ROOT, WEB_PAGE))
  ? readFileSync(path.join(ROOT, WEB_PAGE), "utf8")
  : "";
if (!web) {
  fail(`no se puede leer ${WEB_PAGE}`, "¿se ha movido la práctica de la web?");
} else {
  for (const sound of SOUNDS) {
    if (!web.includes(`/sounds/${sound.file}`)) {
      fail(`la web ya no carga ${sound.file}`, `es el sonido de: ${sound.moment}`);
    }
  }
  // El error original de la web: usar el de victoria para las rachas.
  if (/comboSoundRef\.current = .*perfect/i.test(web)) {
    fail(
      "la web vuelve a usar el sonido de victoria para las rachas",
      "sonaba en cada racha y llegabas al final habiéndolo oído tres veces"
    );
  }
}

if (failures.length > 0) {
  console.error("\nCONTRATO DE SONIDOS DE PRÁCTICA ROTO\n");
  failures.forEach((f, i) => console.error(`  ${i + 1}. ${f}\n`));
  console.error(
    "Estos cinco sonidos los eligió el usuario de oído y suenan bien en ambos móviles.\n" +
      "Si el cambio es deliberado, actualiza scripts/checkPracticeAudio.ts en el mismo commit.\n"
  );
  process.exit(1);
}

console.log("contrato de sonidos de práctica: OK (5 sonidos, app == web, precarga activa)");
