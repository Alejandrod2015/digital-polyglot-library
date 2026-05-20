/**
 * 5 candidate "ring fill" sounds (the one that plays while the score
 * arc animates from 0 to score). Target ~1-2 s, ascending/swelling vibe.
 */
import { uploadPublicObject } from "../src/lib/objectStorage";

const CANDIDATES: { tag: string; title: string; sourceUrl: string }[] = [
  { tag: "ring-drum-roll",          title: "Drum Roll",                       sourceUrl: "https://assets.mixkit.co/active_storage/sfx/566/566-preview.mp3" },
  { tag: "ring-angelic-roll",       title: "Angelic drum roll",               sourceUrl: "https://assets.mixkit.co/active_storage/sfx/573/573-preview.mp3" },
  { tag: "ring-trailer-riser",      title: "Cinematic trailer riser",         sourceUrl: "https://assets.mixkit.co/active_storage/sfx/790/790-preview.mp3" },
  { tag: "ring-wind-roll-swoosh",   title: "Atmospheric wind drum roll swoosh", sourceUrl: "https://assets.mixkit.co/active_storage/sfx/576/576-preview.mp3" },
  { tag: "ring-stutter-riser",      title: "Short space stutter intro riser", sourceUrl: "https://assets.mixkit.co/active_storage/sfx/1144/1144-preview.mp3" },
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
      const uploaded = await uploadPublicObject({ key, body: buf, contentType: "audio/mpeg" });
      console.log(`${c.title.padEnd(40)} → ${uploaded?.url ?? "(failed)"}`);
    } catch (err) {
      console.error(`${c.title}: FAIL ${err instanceof Error ? err.message : err}`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
