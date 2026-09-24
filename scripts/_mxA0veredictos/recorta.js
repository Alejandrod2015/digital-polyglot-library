// Re-corta los clips del revisador snapeando a los silencios REALES del master.
//
// El primer corte usaba un margen fijo (0,25 s delante, 0,35 s detras) sobre
// los tiempos de audioSegments. Como las oraciones van pegadas en el master,
// ese margen se comia el final de la oracion anterior y el principio de la
// siguiente: el usuario oia "como si acabara de decir otra cosa o fuera a
// decirla". Ahora el limite se busca en los huecos que mide ffmpeg
// (silencedetect) con boundaryFor, que es la misma funcion que usa el
// re-empalme de fragmentos.
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const DIR = __dirname;
const fichas = JSON.parse(fs.readFileSync(path.join(DIR, "fichas.json"), "utf8"));

// Copia de scripts/silenceBoundaryLib.ts (este script corre con node a secas).
function boundaryFor(estimate, gaps, tol = 0.08) {
  const dentro = gaps.some(([a, b]) => estimate >= a - tol && estimate <= b + tol);
  if (dentro) return estimate;
  let mejor = estimate, dist = Infinity;
  for (const [a, b] of gaps) {
    const centro = (a + b) / 2;
    const d = Math.abs(estimate - centro);
    if (d < dist) { dist = d; mejor = centro; }
  }
  return gaps.length ? mejor : Math.max(0, estimate - 0.06);
}

function huecosDe(mp3) {
  const out = execFileSync("ffmpeg", ["-nostdin", "-i", mp3, "-af", "silencedetect=n=-35dB:d=0.12", "-f", "null", "-"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] , maxBuffer: 1 << 24}) || "";
  return out;
}

function parseHuecos(txt) {
  const gaps = [];
  let ini = null;
  for (const m of txt.matchAll(/silence_(start|end): ([0-9.]+)/g)) {
    if (m[1] === "start") ini = parseFloat(m[2]);
    else if (ini !== null) { gaps.push([ini, parseFloat(m[2])]); ini = null; }
  }
  return gaps;
}

const cacheGaps = {};
const informe = [];
for (const f of fichas) {
  const mp3 = path.join(DIR, "masters", f.slug + ".mp3");
  if (!cacheGaps[f.slug]) {
    let txt = "";
    try { huecosDe(mp3); } catch (e) { txt = String(e.stderr ?? ""); }
    if (!txt) { try { txt = execFileSync("bash", ["-c",
      `ffmpeg -nostdin -i ${JSON.stringify(mp3)} -af silencedetect=n=-35dB:d=0.12 -f null - 2>&1`],
      { encoding: "utf8", maxBuffer: 1 << 24 }); } catch (e) { txt = String(e.stdout ?? ""); } }
    cacheGaps[f.slug] = parseHuecos(txt);
  }
  const gaps = cacheGaps[f.slug];

  // El estimado es el limite de la ORACION, sin margen. boundaryFor lo deja
  // quieto si ya cae en un hueco real, y si no lo lleva al centro del hueco
  // mas cercano. Asi el clip empieza y acaba en silencio, no a media palabra
  // ni dentro de la frase vecina.
  const iniEst = f.start + 0.25;   // deshace el margen viejo
  const finEst = f.end - 0.35;
  const ini = Math.max(0, boundaryFor(iniEst, gaps));
  const fin = boundaryFor(finEst, gaps);
  informe.push({ id: f.id, antes: [+f.start.toFixed(2), +f.end.toFixed(2)],
    ahora: [+ini.toFixed(2), +fin.toFixed(2)], huecos: gaps.length });
  f.start = ini; f.end = Math.max(ini + 0.5, fin);
}

fs.writeFileSync(path.join(DIR, "fichas.json"), JSON.stringify(fichas, null, 1));
console.log(JSON.stringify(informe.slice(0, 6), null, 1));
console.log("re-cortadas:", fichas.length);
