import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { spawn } from "node:child_process";
import { writeFileSync, readFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const PY = join(process.env.HOME || "", ".cache", "dpl-qa", "venv", "bin", "python");
const TMP = "/private/tmp/claude-501/-Users-alejandrodelcarpio-digital-polyglot-library/82ad62b3-5b6d-4b5d-bd8d-fd63cd9908e7/scratchpad/auditlote";
function run(cmd: string, args: string[]): Promise<number> {
  return new Promise(r => { const c = spawn(cmd, args, {stdio:"inherit"}); c.on("close", x => r(x ?? 1)); });
}
(async () => {
  const js: any[] = await p.journey.findMany({ where: { status: "active" },
    select: { id:true, language:true, variant:true, levels:true } });
  const cand: any[] = [];
  for (const j of js) {
    const st: any[] = await p.journeyStory.findMany({ where: { journeyId: j.id },
      select: { slug:true, practiceSet: { select: { exercises: { select: { word:true, type:true, payload:true } } } } } });
    for (const s of st) for (const e of (s.practiceSet?.exercises ?? []) as any[]) {
      const u = e.payload?.audioClip?.wordClipUrl;
      if (e.type !== "meaning_in_context" || !u) continue;
      const w = String(e.word).trim();
      if (/\s/.test(w) || w.length > 8) continue;
      cand.push({ id: `${j.language}/${j.variant}/${(j.levels??[]).join("")}|${s.slug}|${w}`, url: u, word: w });
    }
  }
  console.log("candidatos:", cand.length);
  const res: any[] = [];
  const B = 200;
  for (let i = 0; i < cand.length; i += B) {
    const lote = cand.slice(i, i + B);
    rmSync(TMP, { recursive: true, force: true }); mkdirSync(TMP, { recursive: true });
    const items: any[] = [];
    let fallos = 0;
    // Concurrencia 8 y 3 intentos: con 200 en paralelo R2 tiraba la mayoria de
    // las descargas y el catch vacio lo escondia (2574 de 3770 se perdieron asi
    // en la primera pasada). Ahora un fallo definitivo se CUENTA.
    const cola = [...lote.entries()];
    const worker = async () => {
      for (;;) {
        const nxt = cola.shift(); if (!nxt) return;
        const [k, c] = nxt;
        let ok = false;
        for (let a = 0; a < 3 && !ok; a++) {
          try {
            const r = await fetch(c.url);
            if (!r.ok) { await new Promise(z => setTimeout(z, 300 * (a + 1))); continue; }
            const f = join(TMP, `c${k}.mp3`);
            writeFileSync(f, Buffer.from(await r.arrayBuffer()));
            items.push({ file: f, id: c.id, word: c.word });
            ok = true;
          } catch { await new Promise(z => setTimeout(z, 300 * (a + 1))); }
        }
        if (!ok) fallos++;
      }
    };
    await Promise.all(Array.from({length: 8}, worker));
    if (fallos) console.log(`  AVISO: ${fallos} descargas perdidas en esta tanda`);
    writeFileSync(join(TMP, "in.json"), JSON.stringify(items));
    await run(PY, ["scripts/_mideLote.py", join(TMP, "in.json"), join(TMP, "out.json")]);
    res.push(...JSON.parse(readFileSync(join(TMP, "out.json"), "utf8")));
    console.log(`  ${Math.min(i+B, cand.length)}/${cand.length}`);
  }
  rmSync(TMP, { recursive: true, force: true });
  const cortas = res.filter(r => r.medible && r.corta);
  const suben = cortas.filter(r => r.sube);
  writeFileSync("scripts/_auditoria-ciego.json", JSON.stringify({ total: res.length, cortas: cortas.length, suben }, null, 2));
  console.log(`\nmedidos ${res.filter(r=>r.medible).length}/${res.length}`);
  console.log(`de tramo corto (<0.35s, el punto ciego): ${cortas.length}`);
  console.log(`de esos, SUENAN A PREGUNTA con el gate nuevo: ${suben.length}`);
  const porJ: Record<string, number> = {};
  for (const s of suben) { const k = s.id.split("|")[0]; porJ[k] = (porJ[k]||0)+1; }
  for (const [k,v] of Object.entries(porJ).sort((a,b)=>b[1]-a[1])) console.log(`  ${k}: ${v}`);
  await p.$disconnect();
})();
