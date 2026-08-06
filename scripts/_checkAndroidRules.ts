// Scratch: exercises the triage gates for the Android path.
//
// Pure functions only. It deliberately does NOT call inviteApplicant, because
// that path ends in the mail sender and the outbound-email lock is not
// something to route around for a test.
import { evaluateApplication, DEFAULT_BETA_RULES } from "../src/lib/betaRules";

const BASE = {
  email: "someone@gmail.com",
  nativeLanguage: "English",
  targetLanguage: "Spanish",
  currentLevel: "Beginner",
  weeklyHours: "3-5",
  motivation: "travel",
  referralSource: "a friend",
  applicationReason:
    "I moved to Mexico City last year and I still freeze whenever the conversation moves past ordering coffee.",
  socialHandle: null,
};

const CASES = [
  {
    name: "android con cuenta de Google",
    app: { ...BASE, platform: "android", googleEmail: "someone.else@gmail.com", appleIdEmail: null, hasIPhone: false },
    expect: "no debe caer por falta de Apple ID ni por no tener iPhone",
  },
  {
    name: "android SIN cuenta de Google",
    app: { ...BASE, platform: "android", googleEmail: null, appleIdEmail: null, hasIPhone: false },
    expect: "queue: no hay a quien meter en el grupo",
  },
  {
    name: "ios sin iPhone",
    app: { ...BASE, platform: "ios", googleEmail: null, appleIdEmail: "a@icloud.com", hasIPhone: false },
    expect: "auto_decline: no hay aparato",
  },
  {
    name: "ambos, solo Apple ID",
    app: { ...BASE, platform: "both", googleEmail: null, appleIdEmail: "a@icloud.com", hasIPhone: true },
    expect: "pasa: la ruta de iOS le sirve",
  },
  {
    name: "fila antigua sin platform",
    app: { ...BASE, platform: null, googleEmail: null, appleIdEmail: "a@icloud.com", hasIPhone: true },
    expect: "pasa como iOS, que es lo que era por construccion",
  },
];

for (const c of CASES) {
  const v = evaluateApplication(c.app, DEFAULT_BETA_RULES, { activeTesterCount: 0 });
  console.log(`\n${c.name}`);
  console.log(`  esperado: ${c.expect}`);
  console.log(`  -> ${v.decision} (score ${v.score}) ${v.reason}`);
}
