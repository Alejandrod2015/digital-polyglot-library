/**
 * Test de voz de "L'océan dit non" (FR A0) con Julien, ANTES de la
 * historia completa. 4 líneas representativas del estilo narrador A0:
 *   1. apertura descriptiva
 *   2. cita embebida de Hugo (quote + tag dentro de la narración)
 *   3. secuencia rítmica de caídas (frases muy cortas)
 *   4. cita embebida con PREGUNTA (« Tu pars demain ? » demande Manon.)
 * Framing francés (regla de oro feedback_elevenlabs_prosody_context:
 * par de framing del idioma ANTES del primer render).
 * Mismo modelo y settings que el pipeline.
 *
 * GASTA CRÉDITOS: correr solo con autorización explícita del usuario.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { mkdirSync, writeFileSync } from "node:fs";

const MODEL = "eleven_multilingual_v2";
const SETTINGS = { stability: 0.4, similarity_boost: 0.8, style: 0.3, speed: 0.9 };
const VOICE = "86fYoxrFeaJKXplThwSl"; // Julien (M storyteller; contraste real vs Aurore)
const PREV_TEXT = "Écoute cette phrase.";
const NEXT_TEXT = "Très bien. Voici la phrase suivante.";
const PREV_TEXT_Q = "Elle a une question et demande :";
const NEXT_TEXT_Q = "Il répond tout de suite.";
const isQuestion = (t: string) => t.trim().endsWith("?");

const LINES = [
  { n: 1, label: "Apertura descriptiva",
    text: "La Côte des Basques est la plage célèbre. Aujourd'hui, Hugo emmène Léa ici. Léa regarde l'eau et son cœur bat vite." },
  { n: 2, label: "Cita embebida (miedo de Léa)",
    text: "« J'ai un peu peur », dit Léa." },
  { n: 3, label: "El beat nuevo (la ola pasa sin ella)",
    text: "Une belle vague arrive. C'est la bonne... mais Léa ne bouge pas. La peur gagne. La vague passe sans elle." },
  { n: 4, label: "Exclamación corta + cierre declarativo",
    text: "« Maintenant ! » dit Hugo. Léa rit. La peur est toujours là, mais maintenant, elle est petite." },
];

(async () => {
  const key = process.env.ELEVENLABS_API_KEY!;
  mkdirSync("public/_fr2-test", { recursive: true });
  const onlyArg = process.argv.find((a) => a.startsWith("--only="));
  const only = onlyArg ? new Set(onlyArg.slice(7).split(",").map(Number)) : null;
  const targets = only ? LINES.filter((l) => only.has(l.n)) : LINES;
  for (const l of targets) {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_128`, {
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
    writeFileSync(`public/_fr2-test/${l.n}.mp3`, Buffer.from(await res.arrayBuffer()));
    console.log(`línea ${l.n} ok (${l.label})`);
  }
  const html = `<!doctype html><meta charset="utf-8"><title>Test Julien FR</title>
<body style="background:#0e1727;color:#eee;font-family:system-ui;max-width:640px;margin:40px auto;padding:0 16px">
<h2>Test de voz — Julien · Grande plage, petite peur</h2>
${LINES.map((l) => `<div style="margin:18px 0;padding:14px;background:#102746;border-radius:12px">
<b>${l.n}. ${l.label}</b><p style="color:#9fb3d1;font-size:14px">${l.text}</p>
<audio controls preload="none" src="/_fr2-test/${l.n}.mp3" style="width:100%"></audio></div>`).join("")}
<p style="color:#9fb3d1">Responde con los números que tengan problemas, o "bien" para aprobar.</p></body>`;
  writeFileSync("public/_fr2-test.html", html);
  console.log("audición: http://localhost:3000/_fr2-test.html");
})();
