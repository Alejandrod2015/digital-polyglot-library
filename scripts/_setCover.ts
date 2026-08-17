import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { uploadPublicObject } from "../src/lib/objectStorage";
import { readFileSync } from "node:fs";
const p = new PrismaClient();
async function main(){
  const [storyId, file] = [process.argv[2], process.argv[3]];
  const buf = readFileSync(file);
  const key = `media/generated/images/${storyId}-cel-clean-${buf.length}.png`;
  const up = await uploadPublicObject({ key, body: buf, contentType: "image/png" });
  if(!up?.url) throw new Error("upload failed");
  await p.journeyStory.update({ where:{id:storyId}, data:{ coverUrl: up.url, coverDone: true }});
  console.log("SET", up.url);
}
main().finally(()=>p.$disconnect());
