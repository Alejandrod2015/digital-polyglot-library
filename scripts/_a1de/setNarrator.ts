import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
import { isVoiceApproved } from "../../src/lib/approvedVoices";
const p = new PrismaClient();
const NARR = "Ww7Sq9tx9CCOiNOwWgsx";
(async () => {
  if (!isVoiceApproved(NARR)) { console.log("voz NO aprobada; abortado"); return; }
  const J = "cmqfnp3tf000032afygkqp8z2";
  const before = await p.journeyStory.count({ where: { journeyId: J, voiceId: NARR } });
  if (process.argv.includes("--apply")) {
    const r = await p.journeyStory.updateMany({ where: { journeyId: J }, data: { voiceId: NARR } });
    console.log(`antes ${before}/21 · actualizadas ${r.count}`);
  } else console.log(`(dry) antes ${before}/21`);
  const after = await p.journeyStory.count({ where: { journeyId: J, voiceId: NARR } });
  console.log(`ahora ${after}/21 con narrador ${NARR}`);
  await p.$disconnect();
})();
