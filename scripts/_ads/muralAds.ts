/**
 * El mural de conceptos de anuncios: una columna por TIPO de anuncio (Lector,
 * Practice, Audiolibros...), una casilla por pieza, todo en una pantalla.
 * Clic en una casilla abre el video; Escape lo cierra.
 *
 *   OUT=<dir> npx tsx scripts/_ads/muralAds.ts
 *   python3 -m http.server <puerto> --directory <dir>
 *
 * Lee los .mp4 de qa/ads/ del repo y de cada worktree (el chat de audiolibros
 * renderiza en el suyo), se queda con el 9:16 de cada pieza y saca su miniatura
 * con ffmpeg. A que tipo va cada pieza lo dice CONCEPTS: un tipo nuevo es una
 * entrada mas, sin tocar el HTML.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, symlinkSync, writeFileSync, rmSync } from "node:fs";
import { basename, join, resolve } from "node:path";

type Concept = { key: string; label: string; blurb: string; match: (slug: string) => boolean };

// El orden es el de las columnas. La primera regla que casa se queda la pieza.
const CONCEPTS: Concept[] = [
  // Organico (Reels, TikTok, Shorts), escenas 60+ con slug "social-". Va
  // primero: si no, "lector-practice" o "practice" se quedarian la pieza.
  {
    key: "redes",
    label: "Redes",
    blurb: "Orgánico: Lector + Practice dinámico, quiz y tour de países",
    match: (s) => /-social-/.test(s),
  },
  {
    key: "lector",
    label: "Lector",
    blurb: "El lector: karaoke, audio y glosa al tocar",
    match: (s) =>
      /^(1-word-synced|2-tap-a-word|5-textbook-vs-real)$/.test(s) ||
      /^(\d+)-/.test(s) && Number(s.split("-")[0]) >= 6 && Number(s.split("-")[0]) <= 23 && !s.includes("books"),
  },
  {
    key: "lector-practice",
    label: "Lector + Practice",
    blurb: "La misma palabra, en la historia y luego en un ejercicio",
    match: (s) => /lector-practice/.test(s),
  },
  {
    key: "practice",
    label: "Practice",
    blurb: "Los ejercicios: Meaning, Context, Listening, Match",
    match: (s) => /practice/.test(s),
  },
  {
    key: "audiolibros",
    label: "Audiolibros",
    blurb: "Un libro narrado con sus modismos",
    match: (s) => /-books-/.test(s),
  },
  {
    key: "coleccion",
    label: "Colección",
    blurb: "Las portadas de una colección",
    match: (s) => /collection|variants/.test(s),
  },
  { key: "otros", label: "Otros", blurb: "Sin tipo asignado", match: () => true },
];

const REPO = resolve(".");
const OUT = resolve(process.env.OUT ?? "/tmp/claude-501/dpl-ads-mural");

function sources(): string[] {
  const dirs = [join(REPO, "qa/ads")];
  const wt = join(REPO, ".claude/worktrees");
  if (existsSync(wt)) {
    for (const name of readdirSync(wt)) {
      const d = join(wt, name, "qa/ads");
      if (existsSync(d)) dirs.push(d);
    }
  }
  return dirs;
}

type Piece = { slug: string; file: string; origin: string; concept: string; feed?: string };

function collect(): Piece[] {
  const bySlug = new Map<string, Piece>();
  for (const dir of sources()) {
    const origin = dir.includes(".claude/worktrees/") ? dir.split(".claude/worktrees/")[1].split("/")[0] : "main";
    for (const f of readdirSync(dir)) {
      const m = f.match(/^(.+?)-(9x16|4x5)\.mp4$/);
      if (!m) continue;
      const slug = m[1];
      const prev = bySlug.get(`${origin}:${slug}`);
      const concept = CONCEPTS.find((c) => c.match(slug))!.key;
      // El 9:16 manda en la casilla; el 4:5 va de segunda version en el visor
      // (y ocupa la casilla solo si la pieza no tiene 9:16).
      if (m[2] === "4x5") {
        if (prev) prev.feed = join(dir, f);
        else bySlug.set(`${origin}:${slug}`, { slug, file: join(dir, f), origin, concept, feed: join(dir, f) });
        continue;
      }
      bySlug.set(`${origin}:${slug}`, { slug, file: join(dir, f), origin, concept, feed: prev?.feed });
    }
  }
  const num = (s: string) => Number(s.split("-")[0]) || 0;
  return [...bySlug.values()].sort((a, b) => num(a.slug) - num(b.slug));
}

function build() {
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(join(OUT, "media"), { recursive: true });
  // ONLY=<key> deja el mural en un solo tipo (p. ej. ONLY=redes).
  const only = process.env.ONLY;
  const pieces = collect().filter((p) => !only || p.concept === only);

  for (const p of pieces) {
    const id = `${p.origin}__${basename(p.file, ".mp4")}`;
    symlinkSync(p.file, join(OUT, "media", `${id}.mp4`));
    if (p.feed && p.feed !== p.file) symlinkSync(p.feed, join(OUT, "media", `${id}-4x5.mp4`));
    execFileSync("ffmpeg", ["-v", "error", "-ss", "0.6", "-i", p.file, "-frames:v", "1", "-vf", "scale=270:-2", "-y", join(OUT, "media", `${id}.jpg`)]);
    (p as Piece & { id: string }).id = id;
  }

  const cols = CONCEPTS.filter((c) => !only || c.key === only).map((c) => {
    const items = pieces.filter((p) => p.concept === c.key) as (Piece & { id: string })[];
    if (!items.length && c.key === "otros") return "";
    const cells = items
      .map(
        (p) =>
          `<button class="cell" data-src="media/${p.id}.mp4"${p.feed && p.feed !== p.file ? ` data-feed="media/${p.id}-4x5.mp4"` : ""} title="${p.slug}${p.origin === "main" ? "" : " (" + p.origin + ")"}">` +
          `<img src="media/${p.id}.jpg" alt=""><span>${p.feed && p.feed !== p.file ? "<b>4:5</b>" : ""}${p.slug}</span></button>`,
      )
      .join("");
    const empty = items.length ? "" : `<p class="empty">Aún sin piezas</p>`;
    return `<section class="col" style="flex-grow:${Math.max(1, Math.ceil(Math.sqrt(items.length)))}"><header><h2>${c.label}</h2><small>${c.blurb} · ${items.length}</small></header><div class="grid">${cells}${empty}</div></section>`;
  }).join("");

  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Mural de anuncios</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
:root{color-scheme:dark;--bg:#0b1220;--panel:#121b2e;--line:#22304b;--ink:#e8eefc;--dim:#8b9ab8}
*{box-sizing:border-box}html,body{margin:0;height:100%;background:var(--bg);color:var(--ink);font:13px/1.3 system-ui,-apple-system,sans-serif;overflow:hidden}
main{height:100vh;display:flex;flex-direction:column;padding:12px;gap:10px}
h1{margin:0;font-size:16px}h1 small{color:var(--dim);font-weight:400;margin-left:8px}
.cols{flex:1;min-height:0;display:flex;gap:10px}
.col{flex:1 1 0;min-width:0;background:var(--panel);border:1px solid var(--line);border-radius:10px;display:flex;flex-direction:column;padding:8px}
.col header{padding:2px 4px 8px}.col h2{margin:0;font-size:14px}.col small{color:var(--dim)}
.grid{flex:1;min-height:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(var(--tile,90px),1fr));grid-auto-rows:min-content;gap:6px;align-content:start;overflow:hidden}
.cell{all:unset;cursor:pointer;display:flex;flex-direction:column;gap:2px}
.cell img{width:100%;aspect-ratio:9/16;object-fit:cover;border-radius:5px;background:#000;border:1px solid var(--line)}
.cell:hover img{outline:2px solid #7aa7ff}
.cell span b{color:#7aa7ff;font-weight:600;margin-right:3px}
.cell span{font-size:9px;color:var(--dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.empty{color:var(--dim);margin:4px}
#lb{position:fixed;inset:0;background:rgba(0,0,0,.85);display:none;align-items:center;justify-content:center;flex-direction:column;gap:8px}
#lb.on{display:flex}#lb nav{display:flex;gap:6px}#lb nav button{all:unset;cursor:pointer;padding:3px 10px;border:1px solid var(--line);border-radius:6px;color:var(--dim)}#lb nav button.on{color:var(--ink);border-color:#7aa7ff}#lb nav[hidden]{display:none}#lb video{max-height:88vh;max-width:92vw;border-radius:8px}#lb p{margin:0;color:var(--dim)}
</style></head><body><main>
<h1>Mural de anuncios<small>${pieces.length} piezas · clic para ver · Esc cierra</small></h1>
<div class="cols">${cols}</div></main>
<div id="lb"><nav hidden><button data-k="src">9:16</button><button data-k="feed">4:5</button></nav><video controls playsinline></video><p></p></div>
<script>
const lb=document.getElementById('lb'),v=lb.querySelector('video'),cap=lb.querySelector('p');
const nav=lb.querySelector('nav');let cur=null;
const show=k=>{v.src=cur.dataset[k];nav.querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.k===k));v.play()};
nav.querySelectorAll('button').forEach(b=>b.onclick=()=>show(b.dataset.k));
document.querySelectorAll('.cell').forEach(c=>c.onclick=()=>{cur=c;nav.hidden=!c.dataset.feed;cap.textContent=c.title;lb.classList.add('on');show('src')});
const close=()=>{v.pause();v.removeAttribute('src');v.load();lb.classList.remove('on')};
const fit=()=>document.querySelectorAll('.grid').forEach(g=>{let w=${only ? 420 : 110};g.style.setProperty('--tile',w+'px');while(g.scrollHeight>g.clientHeight+1&&w>28){w-=2;g.style.setProperty('--tile',w+'px')}});
addEventListener('load',fit);addEventListener('resize',fit);
lb.onclick=e=>{if(e.target===lb)close()};addEventListener('keydown',e=>{if(e.key==='Escape')close()});
</script></body></html>`;
  writeFileSync(join(OUT, "index.html"), html);
  const counts = CONCEPTS.map((c) => `${c.label} ${pieces.filter((p) => p.concept === c.key).length}`).join(" · ");
  console.log(`${OUT}/index.html  (${counts})`);
}

build();
