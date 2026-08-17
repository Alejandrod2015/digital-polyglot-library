import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { createRequire } from "module";
const __req = createRequire(__filename);
try {
  const p = __req.resolve("server-only");
  (__req as unknown as { cache: Record<string, unknown> }).cache[p] = { id: p, filename: p, loaded: true, exports: {} };
} catch { /* noop */ }

import { validateGeneratedStory } from "@/lib/validateGeneratedStory";

const CASES: { name: string; lang: string; text: string; expect: "pass" | "fail" }[] = [
  { name: "ES limpia (patrón A0 Lucía)", lang: "ES", expect: "pass",
    text: "Lucía baja del tren en Madrid y su amiga Marta la espera con flores.\n\nLas dos suben a una barca pequeña y el agua está fría." },
  { name: "ES extranjeros de fondo", lang: "ES", expect: "pass",
    text: "Manu ve combos de extranjeros tomando fotos y le sabe todo a montaje." },
  { name: "ES glosa de jerga (mismo idioma)", lang: "ES", expect: "pass",
    text: "Le fue traduciendo despacio que causa y pata querían decir amigo del alma." },
  { name: "ES traducir metafórico", lang: "ES", expect: "pass",
    text: "Yaneth le tradujo bajito, sin prisa, cada imagen de esa tierra." },
  { name: "ES recién llegada a un pueblo", lang: "ES", expect: "pass",
    text: "Irene es de Madrid y esta vez saluda con un hola rápido, como recién llegada al pueblo." },
  { name: "ES en su país", lang: "ES", expect: "fail",
    text: "En su país el medicamento está a la vista y se paga sin hablar." },
  { name: "ES diccionario", lang: "ES", expect: "fail",
    text: "El jueves Irene se prepara antes de salir, con el diccionario abierto en la mesa." },
  { name: "ES no ha traducido", lang: "ES", expect: "fail",
    text: "Por la noche Irene cae en que no ha traducido nada, le ha salido entero de una vez." },
  { name: "ES comenta su español", lang: "ES", expect: "fail",
    text: "Lucía habla despacio y con miedo. “Mi español es malo”, dice." },
  { name: "ES sentirse extranjera", lang: "ES", expect: "fail",
    text: "Una tarde entre desconocidos amables le basta para dejar de sentirse extranjera." },
  { name: "DE limpia", lang: "DE", expect: "pass",
    text: "Nadia steht im Morgengrauen vor dem Bürgeramt Neukölln und wartet." },
  { name: "DE Ausländerbehörde (institución)", lang: "DE", expect: "pass",
    text: "Aber warte: Absender Ausländerbehörde. Der Flur der Ausländerbehörde riecht nach Kaffee." },
  { name: "DE übersetzt metafórico", lang: "DE", expect: "pass",
    text: "Dose ruft knappe Kommandos, die Fiete blitzschnell in Handgriffe übersetzt." },
  { name: "DE ihr Deutsch", lang: "DE", expect: "fail",
    text: "Ihre Jacke sei voll assi, ihr Deutsch klinge wie aus dem Lehrbuch." },
  { name: "DE Übersetzungsapp", lang: "DE", expect: "fail",
    text: "Sie tippt den Satz in eine Übersetzungsapp, die in steifem Hochdeutsch bestellt." },
  { name: "IT limpia", lang: "IT", expect: "pass",
    text: "Irene domanda al cameriere che cosa copre esattamente quel prezzo." },
  { name: "IT turista de fondo", lang: "IT", expect: "pass",
    text: "Un turista salta la cassa e ordina direttamente al banco, ma nessuno lo serve." },
  { name: "IT abitudine straniera", lang: "IT", expect: "fail",
    text: "Irene lascia due monete sul piattino, per abitudine straniera." },
  { name: "PT limpia", lang: "PT", expect: "pass",
    text: "Nara olha o cardápio e não entende as opções do dia." },
  { name: "PT sotaque", lang: "PT", expect: "fail",
    text: "Ela fala devagar, com um sotaque que todos notam na fila." },
];

async function run() {
  let bad = 0;
  for (const c of CASES) {
    const payload = { title: "T", synopsis: "S", arcType: "reframe-turn", text: c.text, vocab: [] };
    const r = await validateGeneratedStory(JSON.stringify(payload), { language: c.lang, level: "C1", variant: "x", topic: "t" });
    const chk = r.checks.find((x) => x.id === "body-non-native-character");
    const got = chk?.status === "fail" ? "fail" : "pass";
    const ok = got === c.expect;
    if (!ok) bad++;
    console.log(`${ok ? "OK  " : "BAD "} [${c.lang}] ${c.name.padEnd(38)} expect=${c.expect} got=${got}${!ok && chk?.detail ? "  << " + chk.detail.slice(0, 120) : ""}`);
  }
  console.log(`\n${CASES.length - bad}/${CASES.length} casos correctos`);
  process.exit(bad ? 1 : 0);
}
run();
