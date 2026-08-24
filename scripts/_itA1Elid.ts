import fs from "fs";
import { TAPPABLE, resolveGloss } from "../src/lib/tapGlossKey";
const g = JSON.parse(fs.readFileSync("src/data/tapGlosses/italian-traveler-a1.json", "utf8")).glosses as Record<string, { g: string; t: string }>;
const TOPICS = ["roads-and-driving","phones-and-signal","rooms-and-keys","forest-and-hiking","village-festivals","pharmacy-emergencies","bureaucracy-and-paperwork"];
const st = (JSON.parse(fs.readFileSync("scripts/_itA1/ALL.json", "utf8")) as any[])
  .sort((a, b) => TOPICS.indexOf(a.topic) - TOPICS.indexOf(b.topic) || a.slotIndex - b.slotIndex);
const vistos = new Map<string, number>();
for (const s of st) for (const t of `${s.title} ${s.text}`.match(TAPPABLE) ?? []) {
  if (/['’]/.test(t)) vistos.set(t.toLowerCase(), (vistos.get(t.toLowerCase()) ?? 0) + 1);
}
for (const [t, n] of [...vistos].sort((a, b) => b[1] - a[1])) {
  const hit = resolveGloss(g, t);
  console.log(`${t.padEnd(18)} x${String(n).padStart(2)}  -> ${(hit?.token ?? "NADA").padEnd(12)} "${hit?.gloss.g ?? ""}"`);
}
