import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const j: any = await p.journey.findUnique({ where: { id: "cmt09ehi60000320qf9efrypu" } });
  console.log(JSON.stringify({ status: j?.status, name: j?.name, language: j?.language, variant: j?.variant,
    levels: j?.levels, practiceVoiceId: j?.practiceVoiceId, narratorVoiceId: j?.narratorVoiceId,
    cover: j?.coverImageUrl ?? j?.coverUrl }, null, 1));
  await p.$disconnect();
})();
