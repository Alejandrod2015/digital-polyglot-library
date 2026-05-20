/**
 * Download a curated set of Mixkit free SFX (commercial-licence,
 * no attribution required) and upload them to R2 so they get a stable
 * 1-click URL the user can preview without an extra navigation step.
 */
import { uploadPublicObject } from "../src/lib/objectStorage";

const CANDIDATES: { tag: string; title: string; sourceUrl: string }[] = [
  // ─── perfect-score / level-complete ───
  { tag: "perfect-achievement-bell",   title: "Achievement bell",                 sourceUrl: "https://assets.mixkit.co/active_storage/sfx/253/253-preview.mp3" },
  { tag: "perfect-fantasy-success",    title: "Fantasy game success notification", sourceUrl: "https://assets.mixkit.co/active_storage/sfx/1995/1995-preview.mp3" },
  { tag: "perfect-medieval-fanfare",   title: "Medieval show fanfare",            sourceUrl: "https://assets.mixkit.co/active_storage/sfx/462/462-preview.mp3" },
  { tag: "perfect-fairy-win",          title: "Ethereal fairy win sound",         sourceUrl: "https://assets.mixkit.co/active_storage/sfx/523/523-preview.mp3" },
  { tag: "perfect-magic-trophy",       title: "Magic sweep game trophy",          sourceUrl: "https://assets.mixkit.co/active_storage/sfx/502/502-preview.mp3" },
  // ─── loading / ring filling ───
  { tag: "loading-game-countdown",     title: "Simple game countdown",            sourceUrl: "https://assets.mixkit.co/active_storage/sfx/921/921-preview.mp3" },
  { tag: "loading-happy-timer",        title: "Game show happy timer",            sourceUrl: "https://assets.mixkit.co/active_storage/sfx/666/666-preview.mp3" },
  { tag: "loading-fun-suspense",       title: "Game show fun suspense",           sourceUrl: "https://assets.mixkit.co/active_storage/sfx/942/942-preview.mp3" },
];

async function main() {
  const ts = Date.now();
  for (const c of CANDIDATES) {
    try {
      const res = await fetch(c.sourceUrl, {
        headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://mixkit.co/" },
      });
      if (!res.ok) throw new Error(`download ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      const key = `media/preview/${c.tag}-${ts}.mp3`;
      const uploaded = await uploadPublicObject({
        key,
        body: buf,
        contentType: "audio/mpeg",
      });
      console.log(`${c.title.padEnd(40)} → ${uploaded?.url ?? "(failed)"}`);
    } catch (err) {
      console.error(`${c.title}: FAIL ${err instanceof Error ? err.message : err}`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
