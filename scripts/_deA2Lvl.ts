import { isGermanA1A2 } from "../src/lib/cefr/germanA1A2";
for (const w of process.argv.slice(2)) console.log(`${w.padEnd(22)} ${isGermanA1A2(w) ? "ok" : "FUERA"}`);
