// Solo lectura: candidatas libres del plan, dentro o fuera de italianA1A2 (tras el bloque curado KELLY).
import { readFileSync } from "fs";
import { isItalianA1A2 } from "../../src/lib/cefr/italianA1A2";
const C: Record<string, string> = JSON.parse(readFileSync(process.argv[2], "utf8"));
for (const [t, ws] of Object.entries(C)) {
  const w = ws.split(",").map((x) => x.trim());
  const dentro = w.filter((x) => isItalianA1A2(x)), fuera = w.filter((x) => !isItalianA1A2(x));
  console.log(`T${t} dentro ${dentro.length}: ${dentro.join(", ")}\n   fuera ${fuera.length}: ${fuera.join(", ")}`);
}
