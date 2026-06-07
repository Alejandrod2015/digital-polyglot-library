import "dotenv/config";
import * as dotenv from "dotenv";
import { writeFileSync } from "node:fs";
import { PrismaClient } from "../src/generated/prisma";
import { buildCoverPrompt } from "../src/lib/coverGenerator";
import { getStoryCast } from "../src/lib/storyCast";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const STORY_ID = "cmpqkibj70001326n3vpbzwvj";

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

async function flux(prompt: string): Promise<Buffer> {
  const apiKey = process.env.BFL_API_KEY;
  if (!apiKey) throw new Error("Missing BFL_API_KEY");
  const endpoints = [
    "https://api.bfl.ai/v1/flux-2-pro-preview",
    "https://api.us.bfl.ai/v1/flux-2-pro-preview",
    "https://api.bfl.ai/v1/flux-2-pro",
  ];
  let started: any = null;
  let lastErr = "";
  for (const ep of endpoints) {
    try {
      const r = await fetch(ep, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-key": apiKey },
        body: JSON.stringify({ prompt, width: 1536, height: 1024, output_format: "png", safety_tolerance: 2 }),
      });
      if (!r.ok) { lastErr = `${ep} -> ${r.status}: ${(await r.text()).slice(0, 200)}`; continue; }
      started = await r.json();
      break;
    } catch (e) { lastErr = `${ep} -> ${e}`; }
  }
  if (!started) throw new Error(`Flux start failed: ${lastErr}`);
  const pollUrl = started.polling_url || started.result_url ||
    (started.id ? `https://api.us1.bfl.ai/v1/get_result?id=${encodeURIComponent(started.id)}` : null);
  if (!pollUrl) throw new Error("No polling url");
  for (let i = 0; i < 40; i++) {
    await new Promise((res) => setTimeout(res, 2500));
    const p = await fetch(pollUrl, { headers: { "x-key": apiKey } });
    if (!p.ok) continue;
    const j: any = await p.json();
    const url = j?.result?.sample || j?.result?.url || j?.sample || j?.url;
    if (url) {
      const img = await fetch(url);
      return Buffer.from(await img.arrayBuffer());
    }
    const status = (j?.status || j?.result?.status || "").toLowerCase();
    if (status.includes("moderated") || status.includes("error") || status.includes("fail")) {
      throw new Error(`Flux status: ${status}`);
    }
  }
  throw new Error("Flux timed out");
}

async function main() {
  const prisma = new PrismaClient();
  const story = await prisma.journeyStory.findUnique({
    where: { id: STORY_ID },
    include: { journey: true },
  });
  if (!story) throw new Error("Story not found");
  const synopsis = stripHtml(story.synopsis || story.text || "").slice(0, 1600);
  const prompt = buildCoverPrompt({
    title: story.title || "",
    synopsis,
    language: story.journey.language,
    region: story.journey.variant,
    topic: story.topic,
    level: story.level,
    cast: getStoryCast(story.id),
  });
  console.log("=== PROMPT ===\n" + prompt + "\n");
  const buf = await flux(prompt);
  const out = "/tmp/domingo-cover-v5.png";
  writeFileSync(out, buf);
  console.log("Saved " + out + " (" + buf.length + " bytes)");
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
