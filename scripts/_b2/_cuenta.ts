import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import fs from "node:fs";
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
const wc = (t: string) => (t.match(/[\p{L}\p{N}]+(?:['’][\p{L}]+)?/gu) || []).length;
(async () => {
  const j = await p.journey.findUnique({ where: { id: "cmtpls1l20007j8epwgcs6e1h" }, select: { status: true } });
  const s = await p.journeyStory.findMany({ where: { journeyId: "cmtpls1l20007j8epwgcs6e1h" }, select: { slug: true, text: true, topic: true, slotIndex: true, audioUrl: true, voiceId: true } });
  console.log("status", j?.status, "n", s.length, "audio", s.filter(x=>x.audioUrl).length, "voz", s.filter(x=>x.voiceId).length);
  const files: Record<string,string> = {};
  for (let t=1;t<=7;t++) for (const x of JSON.parse(fs.readFileSync(`scripts/_b2/t${t}.json`,"utf8"))) files[x.slug] = x.text;
  let tot=0;
  for (const x of s.sort((a,b)=>a.topic.localeCompare(b.topic)||a.slotIndex-b.slotIndex)) { tot+=wc(x.text); console.log(x.topic, x.slotIndex, x.slug, wc(x.text), files[x.slug]===x.text?"=json":"DIFF"); }
  console.log("media", (tot/s.length).toFixed(1));
  await p.$disconnect();
})();
