/** Los siete temas del A1 latam, rehechos: uno por sitio del A0 y cada uno
 *  sobre el elenco que ya vive ahi. Solo comprueba el porton de evidencia; no
 *  escribe nada. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { assertTopicsGrounded } from "../src/lib/topicEvidence";

const T = [
  { slug: "night-buses",        label: "Night Buses",        evidence: ["speak  Spanish when travelling"] },
  { slug: "prices-and-change",  label: "Prices & Change",    evidence: ["Conduct full business meetings in Spanish"] },
  { slug: "calls-and-messages", label: "Calls & Messages",   evidence: ["I want to have my own conversations with her"] },
  { slug: "help-and-repairs",   label: "Help & Repairs",     evidence: ["that I can’t seem to understand, reached for or fixed"] },
  { slug: "names-for-things",   label: "Names for Things",   evidence: ["understand and use slang from Colombia"] },
  { slug: "doors-and-neighbours", label: "Doors & Neighbours", evidence: ["I wish to talk to neighbours"] },
  { slug: "plans-and-invitations", label: "Plans & Invitations", evidence: ["Liquido en español con mis amigo Alexandros"] },
];
(async () => {
  await assertTopicsGrounded({ language: "spanish", proposals: T });
  console.log("PORTON OK");
})().catch((e) => { console.error("PORTON:", e.message); process.exit(1); });
