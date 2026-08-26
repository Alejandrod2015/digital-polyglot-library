/**
 * Empaqueta los tres correos de la mejora en UNA pagina para
 * mirarlos: a tamaño real, con zoom, y con las capturas ampliables.
 *
 *   npx tsx scripts/_renderBetaEmails.ts && npx tsx scripts/_mailArtifact.ts
 *
 * Las imagenes van embebidas en base64: la pagina se publica como artifact y
 * ahi no hay localhost al que pedirle nada.
 */
import { readFileSync, writeFileSync } from "node:fs";

const SRC = "/tmp/claude-501/beta-emails";
const OUT = process.argv[2] ?? "/tmp/claude-501/beta-emails/artifact.html";

const MAILS = [
  { file: "improvement_colombe", tab: "Colombe", note: "Escribió sobre la gramática" },
  { file: "improvement_ty", tab: "Ty", note: "Escribió sobre el contexto" },
  { file: "improvement", tab: "Todos los demás", note: "Sin cita: la misma noticia" },
];

function dataUri(path: string): string {
  const bytes = readFileSync(`public${path}`);
  const mime = path.endsWith(".gif") ? "image/gif" : "image/png";
  return `data:${mime};base64,${bytes.toString("base64")}`;
}

function bodyOf(html: string): string {
  const body = html.slice(html.indexOf("<body"), html.lastIndexOf("</body>"));
  return body.slice(body.indexOf(">") + 1);
}

/** Cambia las urls de las capturas por su base64 y desarma los enlaces. */
function inline(html: string): string {
  let out = html.replace(
    /https?:\/\/[^"' ]*?(\/email\/glosses\/[a-z0-9-]+\.(?:png|gif)|\/digital-polyglot-logo\.png)/g,
    (_m, path) => dataUri(path),
  );
  // El clic sobre una captura lo gestiona la pagina, no el enlace del correo.
  out = out.replace(/<a href="data:image\/(?:png|gif)[^"]*"([^>]*)>/g, "<a$1>");
  return out;
}

const panels = MAILS.map((mail, i) => {
  const raw = readFileSync(`${SRC}/${mail.file}.html`, "utf-8");
  const subject = (raw.match(/<title>([^<]*)<\/title>/) ?? [, ""])[1];
  return `<section class="panel${i === 0 ? " is-open" : ""}" id="panel-${i}" aria-labelledby="tab-${i}">
    <div class="mail-frame"><div class="mail" data-mail>${inline(bodyOf(raw))}</div></div>
  </section>`;
}).join("\n");

const tabs = MAILS.map(
  (mail, i) =>
    `<button class="tab${i === 0 ? " is-on" : ""}" id="tab-${i}" data-panel="${i}" type="button">
      <span class="tab-name">${mail.tab}</span>
      <span class="tab-note">${mail.note}</span>
    </button>`,
).join("\n");

const page = `<title>Correo de las glosas</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700&family=Archivo:wght@400;500;600;700&display=swap">
<style>
  :root {
    --ground: #eceef2;
    --panel: #ffffff;
    --ink: #131a24;
    --ink-soft: #4a5666;
    --ink-faint: #7e8998;
    --line: #d7dbe3;
    --accent: #1d4ed8;
    --accent-soft: rgba(29, 78, 216, 0.1);
    --shadow: 0 24px 60px -34px rgba(12, 22, 38, 0.55);
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --ground: #0b1016;
      --panel: #141b24;
      --ink: #eef2f8;
      --ink-soft: #a9b4c4;
      --ink-faint: #74808f;
      --line: #26313d;
      --accent: #7dd3fc;
      --accent-soft: rgba(125, 211, 252, 0.14);
      --shadow: 0 24px 60px -30px rgba(0, 0, 0, 0.8);
    }
  }
  :root[data-theme="dark"] {
    --ground: #0b1016;
    --panel: #141b24;
    --ink: #eef2f8;
    --ink-soft: #a9b4c4;
    --ink-faint: #74808f;
    --line: #26313d;
    --accent: #7dd3fc;
    --accent-soft: rgba(125, 211, 252, 0.14);
    --shadow: 0 24px 60px -30px rgba(0, 0, 0, 0.8);
  }

  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--ground);
    color: var(--ink);
    font-family: Archivo, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }

  header {
    position: sticky;
    top: 0;
    z-index: 20;
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 18px 26px;
    padding: 20px 26px 16px;
    background: color-mix(in srgb, var(--ground) 88%, transparent);
    backdrop-filter: blur(10px);
    border-bottom: 1px solid var(--line);
  }
  h1 {
    margin: 0;
    font-family: Fraunces, Georgia, "Times New Roman", serif;
    font-weight: 700;
    font-size: 26px;
    letter-spacing: -0.015em;
    line-height: 1.1;
  }
  .sub { margin: 4px 0 0; color: var(--ink-faint); font-size: 13px; }

  .tabs { display: flex; gap: 8px; flex-wrap: wrap; }
  .tab {
    display: grid;
    gap: 2px;
    text-align: left;
    padding: 8px 14px;
    border-radius: 11px;
    border: 1px solid var(--line);
    background: var(--panel);
    color: var(--ink-soft);
    cursor: pointer;
    font: inherit;
  }
  .tab:hover { border-color: var(--accent); }
  .tab:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .tab.is-on { border-color: var(--accent); background: var(--accent-soft); color: var(--ink); }
  .tab-name { font-weight: 600; font-size: 14px; }
  .tab-note { font-size: 11.5px; color: var(--ink-faint); }

  .zoom { display: flex; align-items: center; gap: 10px; margin-left: auto; }
  .zoom label { font-size: 12px; color: var(--ink-faint); text-transform: uppercase; letter-spacing: 0.09em; }
  .zoom input { width: 190px; accent-color: var(--accent); }
  .zoom output {
    min-width: 52px;
    font-variant-numeric: tabular-nums;
    font-weight: 600;
    font-size: 13px;
  }

  main { padding: 30px 20px 70px; }
  .panel { display: none; }
  .panel.is-open { display: block; }
  .mail-frame { display: flex; justify-content: center; align-items: flex-start; }
  .mail {
    width: 560px;
    box-shadow: var(--shadow);
    border-radius: 18px;
    overflow: hidden;
  }
  .mail img { cursor: zoom-in; }

  dialog {
    border: none;
    padding: 0;
    background: transparent;
    max-width: 96vw;
    max-height: 94vh;
  }
  dialog::backdrop { background: rgba(6, 10, 16, 0.82); }
  dialog img { display: block; max-width: 96vw; max-height: 88vh; border-radius: 14px; }
  .close {
    display: block;
    margin: 12px auto 0;
    padding: 8px 18px;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.28);
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
    font: inherit;
    font-size: 13px;
    cursor: pointer;
  }
  @media (max-width: 700px) {
    .zoom { margin-left: 0; width: 100%; }
    .zoom input { flex: 1; width: auto; }
  }
</style>

<header>
  <div>
    <h1>Correo de las glosas</h1>
    <p class="sub">Lo que ve cada uno al abrirlo. Toca una captura para verla a tamaño real.</p>
  </div>
  <div class="tabs" role="tablist">${tabs}</div>
  <div class="zoom">
    <label for="scale">Tamaño</label>
    <input id="scale" type="range" min="70" max="220" step="5" value="100">
    <output for="scale" id="scaleOut">100%</output>
  </div>
</header>

<main>${panels}</main>

<dialog id="lightbox">
  <img alt="Captura a tamaño real" id="lightboxImg">
  <button class="close" type="button" id="lightboxClose">Cerrar</button>
</dialog>

<script>
  var tabs = Array.prototype.slice.call(document.querySelectorAll(".tab"));
  var panels = Array.prototype.slice.call(document.querySelectorAll(".panel"));
  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      tabs.forEach(function (t) { t.classList.remove("is-on"); });
      panels.forEach(function (p) { p.classList.remove("is-open"); });
      tab.classList.add("is-on");
      document.getElementById("panel-" + tab.dataset.panel).classList.add("is-open");
      applyScale();
    });
  });

  var range = document.getElementById("scale");
  var out = document.getElementById("scaleOut");
  // Se usa zoom y no transform:scale. El scale no ocupa sitio, asi que hay
  // que recalcular a mano la altura del contenedor, y ahi es donde el correo
  // se quedaba fuera de la vista. Con zoom la pagina reflowa sola.
  var supportsZoom = typeof document.body.style.zoom === "string";
  function applyScale() {
    var pct = Number(range.value);
    out.textContent = pct + "%";
    document.querySelectorAll("[data-mail]").forEach(function (mail) {
      if (supportsZoom) {
        mail.style.zoom = String(pct / 100);
      } else {
        mail.style.width = 560 * (pct / 100) + "px";
        mail.style.fontSize = pct + "%";
      }
    });
  }
  range.addEventListener("input", applyScale);
  window.addEventListener("load", applyScale);
  applyScale();

  var box = document.getElementById("lightbox");
  var boxImg = document.getElementById("lightboxImg");
  document.addEventListener("click", function (event) {
    var target = event.target;
    if (target && target.tagName === "IMG" && target.closest("[data-mail]")) {
      event.preventDefault();
      boxImg.src = target.src;
      box.showModal();
    }
  });
  document.getElementById("lightboxClose").addEventListener("click", function () { box.close(); });
  box.addEventListener("click", function (event) { if (event.target === box) box.close(); });
</script>`;

writeFileSync(OUT, page);
console.log(`${OUT} (${Math.round(page.length / 1024)} KB)`);
