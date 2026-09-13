import { isFrenchA1A2 } from "../src/lib/cefr/frenchA1A2";
const ws = process.argv.slice(2).join(" ").split(",").map(s=>s.trim()).filter(Boolean);
console.log("FUERA:", ws.filter(w=>!isFrenchA1A2(w)).join(" | "));
