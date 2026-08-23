/** Que le falta al Traveler DE A0. Solo lectura. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const JID = "cmt0a8vb1000m32p1x7r5ba28";
(async () => {
  const j = await p.journey.findUnique({ where: { id: JID }, select: { status: true } });
  const st = await p.journeyStory.findMany({
    where: { journeyId: JID },
    select: { slug: true, status: true, coverUrl: true, audioUrl: true, audioSegments: true,
              audioWordTimings: true, practiceVoiceId: true, voiceId: true,
              practiceSet: { select: { exercises: { select: { audioUrl: true, payload: true } } } } },
  });
  const n = (f: (x: typeof st[number]) => boolean) => st.filter(f).length;
  console.log(`journey status: ${j?.status} `);
  console.log(`historias: ${st.length} · publicadas: ${n((s) => s.status === "published")}`);
  console.log(`portadas: ${n((s) => !!s.coverUrl)}/${st.length}`);
  console.log(`audio de narracion: ${n((s) => !!s.audioUrl)}/${st.length}`);
  console.log(`karaoke (audioWordTimings): ${n((s) => !!s.audioWordTimings)}/${st.length}`);
  console.log(`voz de narrador puesta: ${n((s) => !!s.voiceId)}/${st.length} · voz de practica: ${n((s) => !!s.practiceVoiceId)}/${st.length}`);
  const ex = st.flatMap((s) => s.practiceSet?.exercises ?? []);
  const conClip = ex.filter((e) => !!e.audioUrl || !!(e.payload as any)?.audioClip?.clipUrl).length;
  console.log(`clips de practica: ${conClip}/${ex.length}`);
  await p.$disconnect();
})();
