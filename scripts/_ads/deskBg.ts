/**
 * El fondo de escritorio del anuncio. UNA imagen, y solo cuando el usuario lo
 * pide con el verbo: el porton 6d del guard lee su ultimo mensaje.
 *
 *   npx tsx scripts/_ads/deskBg.ts --dry        # ve el prompt, no gasta
 *   npx tsx scripts/_ads/deskBg.ts              # una tirada
 *
 * No pasa por scripts/generateCover.ts a proposito: aquel bloquea el estilo de
 * las PORTADAS (color plano, linea gruesa) y aqui hace falta una foto.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const PROMPT_FILE = "scripts/_ads/desk-prompt.txt";
const OUT = "qa/ads/bg-desk.png";

async function main() {
  const prompt = readFileSync(PROMPT_FILE, "utf8").trim();
  if (process.argv.includes("--dry")) {
    console.log(prompt);
    console.log("\n(1080x1920, flux-2-pro; --dry no gasta nada)");
    return;
  }

  const apiKey = process.env.BFL_API_KEY;
  if (!apiKey) throw new Error("Falta BFL_API_KEY");

  const start = await fetch("https://api.bfl.ai/v1/flux-2-pro-preview", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-key": apiKey },
    body: JSON.stringify({
      prompt,
      width: 1080,
      height: 1920,
      output_format: "png",
      safety_tolerance: 2,
    }),
  });
  if (!start.ok) throw new Error(`BFL ${start.status}: ${(await start.text()).slice(0, 300)}`);
  const job = (await start.json()) as { polling_url?: string; id?: string };

  const poll = job.polling_url ?? `https://api.bfl.ai/v1/get_result?id=${job.id}`;
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const res = await fetch(poll, { headers: { "x-key": apiKey } });
    const data = (await res.json()) as { status?: string; result?: { sample?: string } };
    if (data.status === "Ready" && data.result?.sample) {
      const img = await fetch(data.result.sample);
      mkdirSync("qa/ads", { recursive: true });
      writeFileSync(OUT, Buffer.from(await img.arrayBuffer()));
      console.log(`${OUT} listo (1 tirada)`);
      return;
    }
    if (data.status && !["Pending", "Ready", "Request Moderated"].includes(data.status)) {
      throw new Error(`BFL status ${data.status}`);
    }
  }
  throw new Error("BFL no devolvio la imagen a tiempo");
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
