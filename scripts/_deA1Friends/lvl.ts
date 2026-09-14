import { isGermanA1A2 } from "../../src/lib/cefr/germanA1A2";
const ws = process.argv.slice(2);
console.log(ws.map((w) => `${w}:${isGermanA1A2(w) ? "ok" : "FUERA"}`).join("  "));
