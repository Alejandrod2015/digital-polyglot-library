import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import * as fs from "fs";
const p = new PrismaClient();
(async () => {
  const rows = await p.journeyStory.findMany({
    where: { journeyId: "cmr92f0qz000032ff1dfd4fgx" },
    select: { slug: true, title: true, coverUrl: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  const urls = rows.map((r:any)=>r.coverUrl);
  const distinct = new Set(urls).size;
  console.log(`stories: ${rows.length} | with cover: ${urls.filter(Boolean).length} | distinct URLs: ${distinct}`);
  const topics = ["1 Arrival & Registration","2 Housing & Flatshare","3 Work & Office","4 Bureaucracy","5 Everyday Life","6 Friends & Free Time","7 Health & Emergencies"];
  const cards = rows.map((r:any,i:number)=>{
    const t = Math.floor(i/3);
    return `<figure><img src="${r.coverUrl}" loading="lazy"><figcaption><b>${i+1}. ${r.title}</b><br><span class="t">T${t+1} · ${topics[t].split(' ').slice(1).join(' ')}</span></figcaption></figure>`;
  }).join("\n");
  const html = `<!doctype html><meta charset=utf8><title>Expat covers - style B</title>
<style>body{background:#111;color:#eee;font-family:system-ui;margin:0;padding:24px}
h1{font-size:18px;font-weight:600}.g{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;max-width:1100px}
figure{margin:0}img{width:100%;aspect-ratio:16/10;object-fit:cover;border-radius:10px;display:block;background:#222}
figcaption{font-size:12px;margin-top:6px;line-height:1.35}.t{color:#888}</style>
<h1>German Expat - 21 covers (style B lock) &nbsp;<span style="color:#888;font-weight:400">read top-to-bottom for gestalt</span></h1>
<div class=g>${cards}</div>`;
  fs.writeFileSync("public/_expat-covers.html", html);
  console.log("gallery: public/_expat-covers.html");
})().finally(()=>p.$disconnect());
