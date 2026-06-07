import "dotenv/config";
import * as dotenv from "dotenv";
import { readFileSync } from "node:fs";
import { PrismaClient } from "../src/generated/prisma";
import { uploadPublicObject } from "../src/lib/objectStorage";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const JOBS = [
  { storyId: "cmpqkibj70001326n3vpbzwvj", file: "/tmp/domingo-cover-v5.png", base: "domingo-con-papa" },
];

async function main() {
  const prisma = new PrismaClient();
  for (const job of JOBS) {
    const buffer = readFileSync(job.file);
    const filename = `${job.base}-flux-${Date.now()}.png`;
    const uploaded = await uploadPublicObject({
      key: `media/generated/images/${filename}`,
      body: buffer,
      contentType: "image/png",
    });
    if (!uploaded?.url) throw new Error(`upload failed for ${job.storyId}`);
    await prisma.journeyStory.update({
      where: { id: job.storyId },
      data: { coverUrl: uploaded.url, coverDone: true },
    });
    console.log(`${job.storyId} -> ${uploaded.url}`);
  }
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
