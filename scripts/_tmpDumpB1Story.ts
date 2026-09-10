import { config } from "dotenv"; config({ path: ".env.local" }); config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const s = await p.journeyStory.findFirst({
    where: { journeyId: "cmt5x67ze000l320cpgunu5vi", topic: "rooms-and-landlords", slotIndex: 1 },
  });
  console.log(JSON.stringify({ title: s?.title, slug: s?.slug, arcType: (s as any)?.arcType, synopsis: s?.synopsis, text: s?.text }, null, 1));
  console.log("\nVOCAB (3 primeras):", JSON.stringify((s?.vocab as any[])?.slice(0, 3), null, 1));
  console.log("\nvocab count:", (s?.vocab as any[])?.length, "· body words:", String(s?.text ?? "").split(/\s+/).length);
  await p.$disconnect();
})();
