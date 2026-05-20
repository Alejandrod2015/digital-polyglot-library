import { uploadPublicObject } from "../src/lib/objectStorage";

const CANDIDATES: { tag: string; title: string; sourceUrl: string }[] = [
  { tag: "fill-scifi-loading",   title: "Sci-fi loading operative system",   sourceUrl: "https://assets.mixkit.co/active_storage/sfx/2529/2529-preview.mp3" },
  { tag: "fill-electronics-up",  title: "Electronics power up",              sourceUrl: "https://assets.mixkit.co/active_storage/sfx/2602/2602-preview.mp3" },
  { tag: "fill-static-power-up", title: "Electricity static power up",       sourceUrl: "https://assets.mixkit.co/active_storage/sfx/2600/2600-preview.mp3" },
  { tag: "fill-charge-hum",      title: "Electric charge hum",               sourceUrl: "https://assets.mixkit.co/active_storage/sfx/3201/3201-preview.mp3" },
  { tag: "fill-countdown-bleeps", title: "Clock countdown bleeps",            sourceUrl: "https://assets.mixkit.co/active_storage/sfx/916/916-preview.mp3" },
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
      const uploaded = await uploadPublicObject({
        key: `media/preview/${c.tag}-${ts}.mp3`,
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
