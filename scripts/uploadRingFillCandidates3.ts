import { uploadPublicObject } from "../src/lib/objectStorage";

const CANDIDATES: { tag: string; title: string; sourceUrl: string }[] = [
  { tag: "fill-plasma-powerup",   title: "Sci fi plasma gun power up",     sourceUrl: "https://assets.mixkit.co/active_storage/sfx/1679/1679-preview.mp3" },
  { tag: "fill-light-flowing",    title: "Shot light energy flowing",       sourceUrl: "https://assets.mixkit.co/active_storage/sfx/2589/2589-preview.mp3" },
  { tag: "fill-sparkle-sweep",    title: "Sweeping sparkle presentation",   sourceUrl: "https://assets.mixkit.co/active_storage/sfx/2633/2633-preview.mp3" },
  { tag: "fill-fantasy-sweep",    title: "Fantasy game sweep notification", sourceUrl: "https://assets.mixkit.co/active_storage/sfx/255/255-preview.mp3" },
  { tag: "fill-magic-light-sweep", title: "Magical light sweep",             sourceUrl: "https://assets.mixkit.co/active_storage/sfx/2586/2586-preview.mp3" },
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
