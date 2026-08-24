/** Repunta el journey a los siete temas NUEVOS.
 *
 *  El A1 se rehizo con la forma del A0 (un sitio por tema) y dos temas
 *  cambiaron de slug: `rooms-and-keys` -> `doors-and-neighbours` y
 *  `drivers-and-guides` -> `plans-and-invitations`. Las seis filas de esos dos
 *  temas NO se borran: se les cambia el `topic`, asi que `saveStory` las
 *  encuentra por `topic#slotIndex` y las sobrescribe con el contenido nuevo.
 *  Nada se pierde y no hace falta ningun delete.
 *
 *  Pasa por `assertTopicsGrounded` porque escribe temas.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { assertTopicsGrounded } from "../src/lib/topicEvidence";

const J = "cmt5vxwgd0007324oesy195k8";
const T = [
  { slug: "night-buses",           label: "Night Buses",         evidence: ["speak  Spanish when travelling"] },
  { slug: "prices-and-change",     label: "Prices & Change",     evidence: ["Conduct full business meetings in Spanish"] },
  { slug: "calls-and-messages",    label: "Calls & Messages",    evidence: ["I want to have my own conversations with her"] },
  { slug: "help-and-repairs",      label: "Help & Repairs",      evidence: ["that I can’t seem to understand, reached for or fixed"] },
  { slug: "names-for-things",      label: "Names for Things",    evidence: ["understand and use slang from Colombia"] },
  { slug: "doors-and-neighbours",  label: "Doors & Neighbours",  evidence: ["I wish to talk to neighbours"] },
  { slug: "plans-and-invitations", label: "Plans & Invitations", evidence: ["Liquido en español con mis amigo Alexandros"] },
];
const MUEVE: Record<string, string> = {
  "rooms-and-keys": "doors-and-neighbours",
  "drivers-and-guides": "plans-and-invitations",
};

(async () => {
  await assertTopicsGrounded({ language: "spanish", proposals: T });
  const p = new PrismaClient();
  for (const t of T) {
    await p.topic.upsert({
      where: { slug: t.slug },
      update: {},
      create: { slug: t.slug, label: t.label, isUniversal: false },
    });
  }
  for (const [viejo, nuevo] of Object.entries(MUEVE)) {
    const r = await p.journeyStory.updateMany({ where: { journeyId: J, topic: viejo }, data: { topic: nuevo } });
    console.log(`  ${viejo} -> ${nuevo}: ${r.count} filas`);
  }
  await p.journey.update({ where: { id: J }, data: { topics: T.map((x) => x.slug) } });
  const g = await p.journeyStory.groupBy({ by: ["topic"], where: { journeyId: J }, _count: true });
  console.log("filas por topic:", g.map((x) => `${x.topic}=${x._count}`).join(" "));
  await p.$disconnect();
})().catch((e) => { console.error("FALLO:", e.message); process.exit(1); });
