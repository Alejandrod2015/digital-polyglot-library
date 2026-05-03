#!/usr/bin/env node
// List German stories so we can decide which ones to re-voice with Bark Speaker 4.
import "dotenv/config";
import { PrismaClient } from "../../src/generated/prisma/index.js";

const p = new PrismaClient();
const stories = await p.journeyStory.findMany({
  where: { journey: { language: "german" } },
  orderBy: [{ level: "asc" }, { topic: "asc" }, { slotIndex: "asc" }],
});

const cefrOrder = ["A1", "A2", "B1", "B2", "C1", "C2"];
stories.sort((a, b) => {
  const li = cefrOrder.indexOf(a.level) - cefrOrder.indexOf(b.level);
  if (li !== 0) return li;
  if (a.topic !== b.topic) return a.topic.localeCompare(b.topic);
  return a.slotIndex - b.slotIndex;
});

console.log(`Total: ${stories.length}\n`);
stories.forEach((s, i) => {
  const hasAudio = s.audioUrl ? "YES" : "no ";
  const hasDialog = Array.isArray(s.dialogueSpec) && s.dialogueSpec.length > 0 ? "YES" : "no ";
  console.log(
    `${(i + 1).toString().padStart(2)}. [${s.level}] ${s.topic.padEnd(28)} #${s.slotIndex} | ${(s.title ?? "").padEnd(45)} | audio=${hasAudio} | dialog=${hasDialog} | voice=${s.voiceId ?? "null"} | wc=${s.wordCount ?? "?"}`
  );
});

await p.$disconnect();
