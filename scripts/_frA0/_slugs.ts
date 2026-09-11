// SOLO LECTURA. topic#slotIndex -> slug de las 21 historias, y lo mete en la hoja de practica.
import "dotenv/config";
import fs from "fs";
import { PrismaClient } from "@/generated/prisma";
const p = new PrismaClient();
(async () => {
  const st = await p.journeyStory.findMany({ where: { journeyId: "cmtwo6cys0007j8yzg6ni3fsc" }, select: { topic: true, slotIndex: true, slug: true, practiceVoiceId: true } as any });
  const m = new Map(st.map((s: any) => [`${s.topic}#${s.slotIndex}`, s.slug]));
  const H = "scripts/_frA0/practica_hoja.json";
  const hoja = JSON.parse(fs.readFileSync(H, "utf8"));
  for (const h of hoja) h.slug = m.get(`${h.topic}#${h.slotIndex}`);
  fs.writeFileSync(H, JSON.stringify(hoja, null, 1) + "\n");
  console.log(hoja.map((h: any) => `${h.topic}#${h.slotIndex} ${h.slug}`).join("\n"));
  console.log("sin slug:", hoja.filter((h: any) => !h.slug).length, "· ya hay set curado:", hoja.filter((h: any) => fs.existsSync(`scripts/_sets/${h.slug}.json`)).map((h: any) => h.slug));
  await p.$disconnect();
})();
