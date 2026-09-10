import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
(async () => {
  const p = new PrismaClient();
  const b = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: "spanish-traveler-latam-a2", slug: "" } } });
  const g = b?.glosses as Record<string, any>;
  const muestra = ["la","el","una","dos","chontaduro","terminal","llave","huele","reír","carro","mientras","dominó","chiva"];
  for (const w of muestra) if (g[w]) console.log(w, "→", JSON.stringify(g[w]));
  console.log("total:", Object.keys(g ?? {}).length);
  const names = Object.entries(g ?? {}).filter(([k]) => /^[A-ZÁÉÍÓÚ]/i.test(k) && ["rocío","teresa","wences","iris"].includes(k)); 
  for (const [k, v] of names) console.log(k, "→", JSON.stringify(v));
  await p.$disconnect();
})();
