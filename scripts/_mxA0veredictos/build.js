// Genera el HTML del revisador desde fichas.json + el mapa de assets subidos.
// node build.js fichas.json blobs.json > index.html
const fs = require("fs");
const fichas = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const blobs = fs.existsSync(process.argv[3]) ? JSON.parse(fs.readFileSync(process.argv[3], "utf8")) : {};

const NOTAS = {
  "mx-pintan-el-14-f04-content":
    "Whisper, que es otro reconocedor distinto del que disparo el gate, tambien oye \"Libro\" donde el texto dice \"lee Bruno\". Dos reconocedores independientes coinciden, asi que de los tres avisos de contenido este es el que mas se parece a un defecto real.",
  "mx-poquito-son-dos-dedos-f06-content":
    "El texto escribe \"Poquito = dos dedos\" y el narrador lee el signo en voz alta: \"poquito igual a dos dedos\". El gate compara contra la cadena escrita, donde el \"=\" desaparece al normalizar, y por eso canta. Leer el signo es lo correcto.",
  "mx-la-salsa-no-se-apunta-f03-content":
    "El nombre Itzel: un reconocedor oye \"Ixchel\" y Whisper oye \"Excel\". Los dos tropiezan con el mismo nombre propio, que es lo que suele hacer un reconocedor con un nombre que no esta en su vocabulario.",
};

const TEMAS = {
  "rooftops-and-laundry": "Rooftops & Laundry",
  "haircuts-and-barbershops": "Haircuts & Barbershops",
  "plants-and-balconies": "Plants & Balconies",
  "lost-and-found": "Lost & Found",
  "wrestling-and-masks": "Wrestling & Masks",
  "grills-and-backyards": "Grills & Backyards",
  "parcels-and-deliveries": "Parcels & Deliveries",
};

const datos = fichas.map((f) => ({
  id: f.id,
  titulo: f.titulo,
  tema: TEMAS[f.tema] ?? f.tema,
  kind: f.kind,
  gate: f.gate,
  texto: f.texto,
  nota: NOTAS[f.id] ?? null,
  blob: blobs[f.id] ?? null,
  dur: Number((f.end - f.start).toFixed(1)),
}));

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

process.stdout.write(`<title>Veredictos de Guadalajara</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&display=swap">
<style>
:root{
  --paper:#f2f5f3; --card:#ffffff; --fg:#18211f; --muted:#5c6b67;
  --line:#d7dedb; --line-soft:#e7ecea;
  --accent:#0f6f63; --warn:#8a5c10; --warn-bg:#fdf4e2;
  --ok:#2d6a45; --ok-bg:#e8f2eb; --bad:#9d3327; --bad-bg:#f8eae7;
  --shadow:0 1px 2px rgba(24,33,31,.06), 0 6px 20px rgba(24,33,31,.05);
}
@media (prefers-color-scheme: dark){ :root:not([data-theme="light"]){
  --paper:#101614; --card:#17201d; --fg:#eef3f1; --muted:#93a29d;
  --line:#26322e; --line-soft:#1e2825;
  --accent:#5fc4b4; --warn:#e0ad60; --warn-bg:#2a2115;
  --ok:#76c294; --ok-bg:#16271d; --bad:#e08a7c; --bad-bg:#2a1a17;
  --shadow:0 1px 2px rgba(0,0,0,.3), 0 8px 24px rgba(0,0,0,.25);
}}
:root[data-theme="dark"]{
  --paper:#101614; --card:#17201d; --fg:#eef3f1; --muted:#93a29d;
  --line:#26322e; --line-soft:#1e2825;
  --accent:#5fc4b4; --warn:#e0ad60; --warn-bg:#2a2115;
  --ok:#76c294; --ok-bg:#16271d; --bad:#e08a7c; --bad-bg:#2a1a17;
  --shadow:0 1px 2px rgba(0,0,0,.3), 0 8px 24px rgba(0,0,0,.25);
}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--fg);
  font:16px/1.6 "IBM Plex Sans",ui-sans-serif,-apple-system,sans-serif;}
.wrap{max-width:660px;margin:0 auto;padding-inline:16px;padding-block:28px 72px;}

header{display:flex;flex-wrap:wrap;gap:12px 20px;align-items:baseline;margin-bottom:6px}
h1{font-family:"Source Serif 4",Georgia,serif;font-weight:600;font-size:27px;
  margin:0;letter-spacing:-.01em;text-wrap:balance}
.sub{color:var(--muted);font-size:14px;margin:2px 0 22px}

.marcador{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px}
.pill{font-size:12.5px;letter-spacing:.03em;text-transform:uppercase;
  padding:5px 11px;border-radius:999px;border:1px solid var(--line);
  color:var(--muted);font-variant-numeric:tabular-nums}
.pill b{color:var(--fg);font-weight:600}
.pill.ok{background:var(--ok-bg);border-color:transparent;color:var(--ok)}
.pill.ok b{color:var(--ok)}
.pill.bad{background:var(--bad-bg);border-color:transparent;color:var(--bad)}
.pill.bad b{color:var(--bad)}

.barra{height:3px;background:var(--line-soft);border-radius:2px;overflow:hidden;margin:14px 0 22px}
.barra i{display:block;height:100%;background:var(--accent);width:0;transition:width .25s ease}

.ficha{background:var(--card);border:1px solid var(--line);border-radius:14px;
  padding:22px 22px 20px;box-shadow:var(--shadow)}
.eyebrow{font-size:12px;letter-spacing:.09em;text-transform:uppercase;color:var(--muted);
  display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.eyebrow .sep{opacity:.45}
h2{font-family:"Source Serif 4",Georgia,serif;font-weight:600;font-size:21px;
  margin:6px 0 14px;letter-spacing:-.005em;text-wrap:balance}

.motivo{display:flex;gap:10px;align-items:flex-start;background:var(--warn-bg);
  color:var(--warn);border-radius:9px;padding:10px 13px;font-size:14px;line-height:1.45}
.motivo svg{flex:0 0 auto;width:16px;height:16px;margin-top:2px}
.motivo b{font-weight:600}

video{width:100%;height:54px;display:block;margin:16px 0 4px;border-radius:8px;background:#000}
.sinclip{margin:16px 0 4px;padding:12px;border:1px dashed var(--line);border-radius:8px;
  color:var(--muted);font-size:14px}

.texto{font-family:"Source Serif 4",Georgia,serif;font-size:17px;line-height:1.62;
  margin:16px 0 0;padding-left:15px;border-left:2px solid var(--line)}
.nota{font-size:13.5px;color:var(--muted);line-height:1.5;margin-top:14px;
  padding-top:13px;border-top:1px solid var(--line-soft)}

.acciones{display:flex;gap:10px;margin-top:20px}
.acciones button{flex:1;padding:13px 14px;border-radius:10px;border:1px solid var(--line);
  background:transparent;color:var(--fg);font:inherit;font-weight:500;font-size:15px;cursor:pointer;
  transition:background .12s,border-color .12s,color .12s}
.acciones button:hover{border-color:currentColor}
.acciones .fp:hover{background:var(--ok-bg);color:var(--ok)}
.acciones .real:hover{background:var(--bad-bg);color:var(--bad)}
button:focus-visible,a:focus-visible{outline:2px solid var(--accent);outline-offset:2px}

nav{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:16px}
nav button{background:none;border:none;color:var(--muted);font:inherit;font-size:14px;
  cursor:pointer;padding:6px 8px;border-radius:7px}
nav button:hover:not(:disabled){color:var(--accent)}
nav button:disabled{opacity:.35;cursor:default}
.cuenta{font-size:13px;color:var(--muted);font-variant-numeric:tabular-nums}

.fin{background:var(--card);border:1px solid var(--line);border-radius:14px;
  padding:30px 24px;text-align:center;box-shadow:var(--shadow)}
.fin h2{margin-top:0}
.fin p{color:var(--muted);font-size:15px;margin:0 auto;max-width:44ch}

.pie{margin-top:26px;font-size:13px;color:var(--muted);line-height:1.55}
.pie code{font-size:12.5px;background:var(--line-soft);padding:1px 5px;border-radius:4px}
@media (prefers-reduced-motion: reduce){*{transition:none!important}}
</style>

<div class="wrap">
  <header><h1>Veredictos de Guadalajara</h1></header>
  <p class="sub">Friends ES Mexico A0 &middot; 21 historias, voz Andreti &middot; lo que marcaron los gates, mas las veces que el nombre Itzel no suena it-SEL. Una ficha a la vez, ninguna se re-tiro.</p>

  <div class="marcador" id="marcador"></div>
  <div class="barra"><i id="barra"></i></div>

  <div id="zona"></div>

  <p class="pie">Los clips salen recortados del master ya narrado, no se sintetizo nada nuevo.
  El veredicto se guarda solo; <code>fp</code> es falso positivo (al oido esta bien) y
  <code>real</code> es defecto que habria que re-tirar.</p>
</div>

<script>
const FRAGMENTOS = ${JSON.stringify(datos)};
const ICONO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 8v5M12 17h.01"/><circle cx="12" cy="12" r="9"/></svg>';
const esc = (s) => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");

let db = null, veredictos = {}, cola = [], idx = 0;
const zona = document.getElementById("zona");
const marcador = document.getElementById("marcador");
const barra = document.getElementById("barra");

function pintaMarcador(){
  const vals = Object.values(veredictos);
  const fp = vals.filter(v => v === "fp").length;
  const real = vals.filter(v => v === "real").length;
  marcador.innerHTML =
    '<span class="pill">pendientes <b>' + cola.length + '</b></span>' +
    '<span class="pill ok">bien <b>' + fp + '</b></span>' +
    '<span class="pill bad">defecto real <b>' + real + '</b></span>';
  const hechos = FRAGMENTOS.length - cola.length;
  barra.style.width = (100 * hechos / FRAGMENTOS.length) + "%";
}

function pinta(){
  pintaMarcador();
  if (!cola.length){
    zona.innerHTML = '<div class="fin"><h2>Las ' + FRAGMENTOS.length + ' juzgadas</h2>' +
      '<p>No queda ninguna ficha pendiente. Los veredictos estan guardados y se leen desde el chat.</p></div>';
    return;
  }
  if (idx >= cola.length) idx = cola.length - 1;
  const f = cola[idx];
  zona.innerHTML =
    '<div class="ficha">' +
      '<div class="eyebrow"><span>' + esc(f.tema) + '</span><span class="sep">/</span><span>' + esc(f.id) + '</span></div>' +
      '<h2>' + esc(f.titulo) + '</h2>' +
      '<div class="motivo">' + ICONO + '<span><b>' + esc(f.gate) + '</b></span></div>' +
      (f.blob
        ? '<video controls preload="metadata" src="/_blob/' + f.blob + '"></video>'
        : '<div class="sinclip">Sin clip: este fragmento no se pudo recortar.</div>') +
      '<p class="texto">' + esc(f.texto) + '</p>' +
      (f.nota ? '<p class="nota">' + esc(f.nota) + '</p>' : '') +
      '<div class="acciones">' +
        '<button class="fp" id="b-fp">' + (f.kind === "nombre" ? "Suena it-SEL" : "Al oido esta bien") + '</button>' +
        '<button class="real" id="b-real">' + (f.kind === "nombre" ? "Suena de otra forma" : "Defecto real") + '</button>' +
      '</div>' +
      '<nav>' +
        '<button id="b-prev">&larr; anterior</button>' +
        '<span class="cuenta">' + (idx + 1) + ' / ' + cola.length + ' pendientes</span>' +
        '<button id="b-next">siguiente &rarr;</button>' +
      '</nav>' +
    '</div>';
  document.getElementById("b-fp").onclick = () => juzga("fp");
  document.getElementById("b-real").onclick = () => juzga("real");
  const prev = document.getElementById("b-prev"), next = document.getElementById("b-next");
  prev.disabled = idx === 0; next.disabled = idx >= cola.length - 1;
  prev.onclick = () => { idx--; pinta(); };
  next.onclick = () => { idx++; pinta(); };
}

async function juzga(v){
  const f = cola[idx];
  veredictos[f.id] = v;
  cola.splice(idx, 1);
  pinta();
  if (db) {
    try {
      await db.doc("verdicts/" + f.id).set({
        journey: "friends-es-mexico-a0", veredicto: v,
        gate: f.gate, kind: f.kind, historia: f.titulo, fecha: new Date().toISOString(),
      });
    } catch (e) { /* el veredicto ya se ve; si no se guardo, se vuelve a juzgar */ }
  }
}

document.addEventListener("keydown", (e) => {
  if (!cola.length) return;
  if (e.key === "ArrowLeft" && idx > 0) { idx--; pinta(); }
  if (e.key === "ArrowRight" && idx < cola.length - 1) { idx++; pinta(); }
});

cola = FRAGMENTOS.slice();
pinta();

(async () => {
  db = await window.claude?.use?.("db") ?? null;
  if (!db) return;
  try {
    const previos = await db.collection("verdicts").where("journey", "==", "friends-es-mexico-a0").get();
    for (const d of (previos.docs ?? previos ?? [])) {
      const id = d.id ?? d.docId; const data = d.data ? d.data() : d;
      if (id && data?.veredicto) veredictos[id] = data.veredicto;
    }
    cola = FRAGMENTOS.filter(f => !veredictos[f.id]);
    idx = 0;
    pinta();
  } catch (e) { /* sin veredictos previos: la cola entera */ }
})();
</script>
`);
