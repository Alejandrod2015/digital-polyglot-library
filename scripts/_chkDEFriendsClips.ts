import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();

const JID = "cmroo4w4v0000324ow1o9qlcp"; // Friends DE C1 germany

(async () => {
  const j = await p.journey.findUnique({ where: { id: JID }, select: { id:true, language:true, variant:true, status:true, name:true } });
  console.log("JOURNEY:", JSON.stringify(j));

  const stories = await p.journeyStory.findMany({
    where: { journeyId: JID },
    select: {
      slug:true, status:true, voiceId:true, practiceVoiceId:true,
      practiceSet: { select: { exercises: { select: { type:true, payload:true } } } },
    },
    orderBy: { createdAt: "asc" },
  });

  const byStatus: Record<string, number> = {};
  let pubCount = 0, exTotal = 0, exWithClip = 0, listenChoose = 0;
  const typeTotal: Record<string, number> = {};
  const typeWithClip: Record<string, number> = {};
  let storiesNoSet = 0;
  const voices = new Set<string>();

  for (const s of stories) {
    byStatus[s.status||"null"] = (byStatus[s.status||"null"]||0)+1;
    if (s.status === "published") pubCount++;
    if (s.voiceId) voices.add(s.voiceId);
    const exs = s.practiceSet?.exercises ?? [];
    if (!s.practiceSet) storiesNoSet++;
    for (const e of exs) {
      exTotal++;
      typeTotal[e.type] = (typeTotal[e.type]||0)+1;
      const pl = e.payload as any;
      const clip = pl?.audioClip?.clipUrl;
      if (e.type === "listen_choose") { listenChoose++; continue; }
      if (typeof clip === "string" && clip.length > 0) {
        exWithClip++;
        typeWithClip[e.type] = (typeWithClip[e.type]||0)+1;
      }
    }
  }

  console.log("stories total:", stories.length, "| published:", pubCount, "| status:", JSON.stringify(byStatus));
  console.log("stories without practiceSet:", storiesNoSet);
  console.log("distinct story voiceIds:", JSON.stringify([...voices]));
  console.log(`exercises total: ${exTotal} | listen_choose (no clip needed): ${listenChoose}`);
  const needsClip = exTotal - listenChoose;
  console.log(`exercises needing a sentence clip: ${needsClip} | WITH clip: ${exWithClip} | MISSING: ${needsClip - exWithClip}`);
  console.log("per-type totals:", JSON.stringify(typeTotal));
  console.log("per-type with clip:", JSON.stringify(typeWithClip));
})().catch(e => console.log("ERR", e.message)).finally(() => p.$disconnect());
