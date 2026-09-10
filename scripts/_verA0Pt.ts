// Solo lectura: campos del Traveler PT-BR A0 nuevo.
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
p.journey.findUniqueOrThrow({ where: { id: "cmtvpqsfv000832hgemzk20cl" }, select: { name: true, typeSlug: true, levels: true, status: true, nextJourneyId: true, storiesPerTopic: true, _count: { select: { stories: true } } } })
  .then((j) => console.log(JSON.stringify(j))).finally(() => p.$disconnect());
