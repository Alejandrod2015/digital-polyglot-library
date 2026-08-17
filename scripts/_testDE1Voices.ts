/**
 * Test de voces de la historia 1 del journey Expat (DE C1) ANTES de la
 * generación completa. 4 líneas que estresan los modos de fallo conocidos:
 *   1. narrador largo atmosférico (moritz)
 *   2. pregunta de Nadia (ela_warm); riesgo: pregunta plana
 *   3. refrán + explicación de Timo (marius); riesgo: ritmo del proverbio
 *   4. exclamación de Nadia; riesgo: uptalk / balbuceo de cola
 * Mismo modelo y settings que el pipeline (eleven_multilingual_v2,
 * stability 0.4 / style 0.3 / speed 0.9). Salida: public/_de1-test/*.mp3
 * + página de audición numerada public/_de1-test.html.
 *
 * GASTA CRÉDITOS: correr solo con autorización explícita del usuario.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { mkdirSync, writeFileSync } from "node:fs";

const MODEL = "eleven_multilingual_v2";
const SETTINGS = { stability: 0.4, similarity_boost: 0.8, style: 0.3, speed: 0.9 };
// Framing con oraciones COMPLETAS: solo una frontera entre dos oraciones
// cierra la prosodia final (misma lección que _genPracticeClips.ts, líneas
// 51-57). next_text=" " suena a continuación: v1 de este test lo sufrió.
const PREV_TEXT = "Hör dir diesen Satz an.";
const NEXT_TEXT = "Gut. Weiter zum nächsten Satz.";
const PREV_TEXT_Q = "Er hat eine Frage und fragt:";
const NEXT_TEXT_Q = "Sie antwortet ihm sofort.";
const isQuestion = (t: string) => t.trim().endsWith("?");

const LINES = [
  { n: 1, speaker: "Narrador (moritz)", voice: "Ww7Sq9tx9CCOiNOwWgsx",
    text: "Viertel vor sieben, Bürgeramt Neukölln. Der Himmel über der Karl-Marx-Straße hat die Farbe von nassem Beton, und Nadia versteht allmählich, warum hier alle eine Thermoskanne dabeihaben." },
  { n: 2, speaker: "Nadia (ela_warm); pregunta", voice: "SJJe86Va82zRzg6zi2dX",
    text: "Und du? Du siehst nicht aus, als würdest du zum Vergnügen um diese Uhrzeit hier stehen." },
  { n: 3, speaker: "Timo (marius); refrán", voice: "JDXBO1etYlVlJZRMoYzH",
    text: "Ich pflege sozusagen eine Tradition. Punkt sieben spuckt das Portal die stornierten Termine aus. Wer zuerst klickt, mahlt zuerst." },
  { n: 4, speaker: "Nadia (ela_warm); exclamación", voice: "SJJe86Va82zRzg6zi2dX",
    text: "Da ist einer! Heute, 11:20 Uhr. Ich habe tatsächlich einen Termin ergattert." },
];

(async () => {
  const key = process.env.ELEVENLABS_API_KEY!;
  mkdirSync("public/_de1-test", { recursive: true });
  // --only=1,3 regenera solo esas líneas (las demás conservan su mp3)
  const onlyArg = process.argv.find((a) => a.startsWith("--only="));
  const only = onlyArg ? new Set(onlyArg.slice(7).split(",").map(Number)) : null;
  const targets = only ? LINES.filter((l) => only.has(l.n)) : LINES;
  for (const l of targets) {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${l.voice}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        text: l.text,
        model_id: MODEL,
        voice_settings: SETTINGS,
        previous_text: isQuestion(l.text) ? PREV_TEXT_Q : PREV_TEXT,
        next_text: isQuestion(l.text) ? NEXT_TEXT_Q : NEXT_TEXT,
      }),
    });
    if (!res.ok) throw new Error(`línea ${l.n}: ${res.status} ${await res.text()}`);
    writeFileSync(`public/_de1-test/${l.n}.mp3`, Buffer.from(await res.arrayBuffer()));
    console.log(`línea ${l.n} ok (${l.speaker})`);
  }
  const html = `<!doctype html><meta charset="utf-8"><title>Test voces DE1</title>
<body style="background:#0e1727;color:#eee;font-family:system-ui;max-width:640px;margin:40px auto;padding:0 16px">
<h2>Test de voces; Bürgeramt Neukölln, sieben Uhr</h2>
${LINES.map((l) => `<div style="margin:18px 0;padding:14px;background:#102746;border-radius:12px">
<b>${l.n}. ${l.speaker}</b><p style="color:#9fb3d1;font-size:14px">${l.text}</p>
<audio controls preload="none" src="/_de1-test/${l.n}.mp3" style="width:100%"></audio></div>`).join("")}
<p style="color:#9fb3d1">Responde con los números que tengan problemas, o "bien" para aprobar.</p></body>`;
  writeFileSync("public/_de1-test.html", html);
  console.log("audición: http://localhost:3000/_de1-test.html");
})();
