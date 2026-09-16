import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;" }[c]!));
(async () => {
  const stories: any[] = await p.journeyStory.findMany({
    where: { journeyId: "cmu0doigc0007j8e292tycths" }, orderBy: [{ topic: "asc" }, { slotIndex: "asc" }],
    select: { slug: true, title: true, topic: true, slotIndex: true,
      practiceSet: { select: { exercises: { select: { word: true, type: true, payload: true } } } } },
  });
  let nW = 0, nS = 0, nFalta = 0;
  const secs = stories.map(s => {
    const exs = (s.practiceSet?.exercises ?? []) as any[];
    const rows = exs.filter(e => e.type === "meaning_in_context" || e.type === "fill_blank").map(e => {
      const ac = e.payload?.audioClip ?? {};
      if (ac.wordClipUrl) nW++; if (ac.clipUrl) nS++;
      const falta = (e.type === "meaning_in_context" && !ac.wordClipUrl) || (e.type === "fill_blank" && !ac.clipUrl);
      if (falta) nFalta++;
      return `<tr class="${falta ? "falta" : ""}"><td class="w">${esc(e.word ?? "")}</td><td class="t">${e.type === "fill_blank" ? "hueco" : "sentido"}</td>
        <td>${ac.wordClipUrl ? `<audio controls preload="none" src="${ac.wordClipUrl}"></audio>` : "<span class=no>sin palabra</span>"}</td>
        <td>${ac.clipUrl ? `<audio controls preload="none" src="${ac.clipUrl}"></audio>` : "<span class=no>sin frase</span>"}</td>
        <td class="s">${esc(ac.sentence ?? "")}</td></tr>`;
    }).join("");
    return `<h2>${esc(s.topic)} · ${s.slotIndex + 1} · ${esc(s.title ?? s.slug)}</h2>
      <table><thead><tr><th>palabra</th><th>tipo</th><th>audio palabra</th><th>audio frase</th><th>frase</th></tr></thead><tbody>${rows}</tbody></table>`;
  }).join("\n");
  const html = `<!doctype html><meta charset="utf-8"><title>Audicion practica FR B1 Lille</title>
<style>body{font:15px/1.5 -apple-system,system-ui,sans-serif;margin:24px auto;max-width:1100px;color:#1a1a1a}
h1{font-size:22px}h2{font-size:15px;margin:28px 0 6px;color:#444;border-bottom:1px solid #ddd;padding-bottom:4px}
table{border-collapse:collapse;width:100%}td,th{padding:4px 8px;border-bottom:1px solid #eee;text-align:left;vertical-align:middle}
th{font-size:12px;color:#777;font-weight:600}.w{font-weight:600;white-space:nowrap}.t{font-size:12px;color:#888}
.s{font-size:13px;color:#555}audio{height:30px;width:200px}.no{font-size:12px;color:#c00}tr.falta{background:#fff4f4}
.sum{background:#f6f6f6;padding:10px 14px;border-radius:6px;font-size:14px}</style>
<h1>Audición de práctica · Friends FR B1 Lille</h1>
<div class="sum">${stories.length} historias · ${nW} clips de palabra · ${nS} clips de frase · <b>${nFalta} huecos que bloquean el publish</b> (fila en rojo)</div>
${secs}`;
  const out = join(process.cwd(), "public", "_audicion-fr-b1.html");
  writeFileSync(out, html);
  console.log(`${out}\n${stories.length} historias | ${nW} palabras | ${nS} frases | ${nFalta} huecos`);
  await p.$disconnect();
})();
