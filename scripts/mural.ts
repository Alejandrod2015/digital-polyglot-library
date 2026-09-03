/** EL MURAL: las imagenes de producto de un journey en UNA sola pantalla, sin
 *  scroll. Una columna por tema, una fila por historia. Asi lo pide el usuario
 *  y asi se le da siempre que pida ver imagenes de producto (2026-08-24).
 *
 *  Sirve para juzgar COHERENCIA entre portadas, que es para lo unico que vale
 *  una hoja de contactos; los defectos de UNA se miran a tamano completo, y por
 *  eso cada casilla se abre en grande al hacer clic (Escape la cierra). Sin ese
 *  clic la hoja escondia los ninos del fondo y el texto pequeno, que es la
 *  pega que tiene la regla de portadas contra las hojas de contactos.
 *
 *  Se regenera desde la base, asi que los huecos se llenan solos.
 *
 *  uso: OUT=<dir> npx tsx scripts/mural.ts [journeyId] */
import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import * as fs from "fs";
import * as path from "path";
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const A1 = process.argv[2] || "cmt5vxwgd0007324oesy195k8";
// Etiqueta de columna: la ciudad donde pasa el tema si la sabemos, y si no el
// slug del tema, que siempre existe.
const CIUDAD: Record<string, string> = {
  "night-buses": "Cusco", "prices-and-change": "Coyoacán", "calls-and-messages": "Cartagena",
  "help-and-repairs": "Oaxaca", "names-for-things": "San Telmo",
  "doors-and-neighbours": "Barranquilla", "plans-and-invitations": "Palermo",
};
const H = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
(async () => {
  const out = process.env.OUT;
  if (!out) { console.error("uso: OUT=<dir> ..."); process.exit(1); }
  const j = await p.journey.findUnique({ where: { id: A1 }, select: { topics: true, name: true, language: true, variant: true, levels: true } });
  const st = await p.journeyStory.findMany({ where: { journeyId: A1 },
    select: { slug: true, title: true, topic: true, slotIndex: true, coverUrl: true } });
  const hechas = st.filter((s) => s.coverUrl).length;
  const celdas: string[] = [];
  for (const t of j!.topics) {
    celdas.push(`<div class="col"><div class="cab">${H(CIUDAD[t] ?? t)}</div>`);
    for (const s of st.filter((x) => x.topic === t).sort((a, b) => a.slotIndex - b.slotIndex)) {
      celdas.push(s.coverUrl
        ? `<figure class="c"><img src="${H(s.coverUrl)}" alt="${H(s.title ?? "")}" data-t="${H(s.title ?? "")}"><figcaption>${H(s.title ?? "")}</figcaption></figure>`
        : `<figure class="c vacia"><div class="hueco">sin portada</div><figcaption>${H(s.title ?? "")}</figcaption></figure>`);
    }
    celdas.push(`</div>`);
  }
  const html = `<!doctype html>
<meta charset="utf-8">
<title>Mural · ${H(j!.name)} ${H(j!.language)}/${H(j!.variant)} ${H(j!.levels.join(","))}</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin:0; height:100vh; overflow:hidden; background:#0d1b2e; color:#e8eef7;
         font:14px/1.35 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
         display:flex; flex-direction:column; padding:14px 16px 16px; }
  header { flex:0 0 auto; display:flex; align-items:baseline; gap:14px; margin-bottom:10px; }
  h1 { font-size:17px; margin:0; }
  .cuenta { font-size:13px; color:#9db0c9; }
  .rejilla { flex:1 1 auto; min-height:0; display:grid;
             grid-template-columns:repeat(${j!.topics.length}, 1fr); gap:10px; }
  .col { min-height:0; display:grid; grid-template-rows:auto repeat(${Math.max(1, Math.max(...j!.topics.map((t) => st.filter((s) => s.topic === t).length)))}, 1fr); gap:8px; }
  .cab { font-size:12px; letter-spacing:.06em; text-transform:uppercase; color:#7fb0ff; }
  .c { margin:0; min-height:0; display:flex; flex-direction:column; gap:3px; }
  .c img { width:100%; flex:1 1 auto; min-height:0; object-fit:cover; border-radius:6px;
           border:1px solid #1e3a5c; cursor:zoom-in; display:block; }
  .vacia .hueco { flex:1 1 auto; border:1px dashed #26456e; border-radius:6px;
                  display:flex; align-items:center; justify-content:center;
                  color:#546f95; font-size:11px; }
  figcaption { font-size:10.5px; color:#8ea5c2; white-space:nowrap; overflow:hidden;
               text-overflow:ellipsis; }
  #lupa { position:fixed; inset:0; background:rgba(5,12,22,.94); display:none;
          align-items:center; justify-content:center; flex-direction:column; gap:10px;
          padding:24px; cursor:zoom-out; z-index:9; }
  #lupa img { max-width:96vw; max-height:88vh; border-radius:10px; }
  #lupa p { margin:0; color:#c3d3e8; font-size:14px; }
</style>
<header>
  <h1>${H(j!.name)} · ${H(j!.variant)} · ${H(j!.levels.join(","))}</h1>
  <span class="cuenta">${hechas} de ${st.length} · clic en una para verla grande</span>
</header>
<div class="rejilla">
${celdas.join("\n")}
</div>
<div id="lupa"><img alt=""><p></p></div>
<script>
  const lupa = document.getElementById("lupa");
  const grande = lupa.querySelector("img"), pie = lupa.querySelector("p");
  document.querySelectorAll(".c img").forEach((im) => im.addEventListener("click", () => {
    grande.src = im.src; pie.textContent = im.dataset.t; lupa.style.display = "flex";
  }));
  lupa.addEventListener("click", () => { lupa.style.display = "none"; grande.src = ""; });
  addEventListener("keydown", (e) => { if (e.key === "Escape") lupa.click(); });
</script>`;
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, "index.html"), html, "utf8");
  console.log(`${hechas}/${st.length} portadas · ${path.join(out, "index.html")}`);
  await p.$disconnect();
})();
