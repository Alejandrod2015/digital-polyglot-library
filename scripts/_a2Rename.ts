import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { assertTopicsGrounded, type TopicProposal } from "@/lib/topicEvidence";
import { PrismaClient } from "../src/generated/prisma";

/**
 * Traveler ES/LATAM A2: los siete temas pasan a nombrar el INTERLOCUTOR, no
 * el campo léxico. Cada tema dice CON QUIÉN se habla en sus tres historias.
 */
const MAP: Array<{ from: string; to: TopicProposal; country: string }> = [
  { from: "rooms-and-renting", country: "mexico", to: { label: "Neighbours & Landlords", slug: "neighbours-and-landlords",
      evidence: ["I wish to talk to neighbours", "I started to learn Spanish for my new girlfriend"] } },
  { from: "work-and-shifts", country: "colombia", to: { label: "Bosses & Workmates", slug: "bosses-and-workmates",
      evidence: ["full business meetings", "for my job and friends"] } },
  { from: "rehearsals-and-nerves", country: "argentina", to: { label: "Friends Of Friends", slug: "friends-of-friends",
      evidence: ["enlarge my social, language and cultural skills", "fun and interactive method"] } },
  { from: "illness-and-remedies", country: "colombia", to: { label: "Doctors & Nurses", slug: "doctors-and-nurses",
      evidence: ["every time she need something", "seem to understand, reached for or fixed"] } },
  { from: "paint-and-workshops", country: "mexico", to: { label: "Teachers & Customers", slug: "teachers-and-customers",
      evidence: ["from the real pepole living there point of view", "understand and use slang"] } },
  { from: "arguments-and-apologies", country: "argentina", to: { label: "Close Friends", slug: "close-friends",
      evidence: ["he never seems to translate the way I would translate myself", "know peoples secrets"] } },
  { from: "goodbyes-and-promises", country: "peru", to: { label: "Drivers & Guides", slug: "drivers-and-guides",
      evidence: ["I want to have my own conversations with her", "want to try all the chances which are available"] } },
];

const JOURNEY = "cmtgelq560007j84n3ujx9bpd";
const p = new PrismaClient();
(async () => {
  const js = await p.journey.findMany({ where: { language: "spanish", status: { not: "archived" } }, select: { topics: true } });
  const tops = await p.topic.findMany({ where: { slug: { in: [...new Set(js.flatMap((j) => j.topics))] } }, select: { label: true } });
  await assertTopicsGrounded({ language: "spanish", proposals: MAP.map((m) => m.to), existingLabels: tops.map((t) => t.label), prisma: p });

  let sort = ((await p.topic.aggregate({ _max: { sortOrder: true } }))._max.sortOrder ?? 0) + 1;
  for (const m of MAP) {
    await p.topic.upsert({ where: { slug: m.to.slug! }, update: { label: m.to.label },
      create: { slug: m.to.slug!, label: m.to.label, isUniversal: false, sortOrder: sort++ } });
    const n = await p.journeyStory.updateMany({ where: { journeyId: JOURNEY, topic: m.from }, data: { topic: m.to.slug! } });
    console.log(`  ${m.from.padEnd(24)} -> ${m.to.slug!.padEnd(24)} (${n.count} historias · ${m.country})`);
  }
  await p.journey.update({ where: { id: JOURNEY }, data: { topics: MAP.map((m) => m.to.slug!) } });
  // Los slugs viejos quedan huérfanos: los borro para no dejar etiquetas muertas
  // en una tabla que es global y compartida.
  const del = await p.topic.deleteMany({ where: { slug: { in: MAP.map((m) => m.from) } } });
  console.log(`temas viejos borrados: ${del.count}`);
})().finally(() => p.$disconnect());
