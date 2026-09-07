/** ¿De dónde salió "teclea" en una historia portuguesa?
 *
 *  Es una palabra española, y está pegada a senha-b-quarenta-e-dois del
 *  B1 portugués sin salir en su texto. Si la misma glosa vive en un bundle
 *  español, no es un resto de edición: es una fuga de un bundle a otro, y eso
 *  se arregla en la tubería, no borrando la fila. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";

const p = new PrismaClient();

(async () => {
  const filas = await p.tapGlossSet.findMany({ select: { bundle: true, slug: true, glosses: true } });
  console.log("── dónde vive la clave \"teclea\"");
  for (const f of filas) {
    const g = f.glosses as Record<string, unknown>;
    if (!g?.teclea) continue;
    console.log(`  ${f.bundle} · ${f.slug || "(global)"}\n    ${JSON.stringify(g.teclea)}`);
  }

  console.log("\n── otras claves del B1 que también viven en un bundle español");
  const b1 = filas.filter((f) => f.bundle === "portuguese-traveler-brazil-b1");
  const sospechosas = ["corta", "então", "começa", "faz", "some", "cidade", "não", "frase", "lugar", "estava", "folheto", "trâmite"];
  for (const w of sospechosas) {
    const donde = filas
      .filter((f) => f.bundle !== "portuguese-traveler-brazil-b1" && (f.glosses as Record<string, unknown>)?.[w])
      .map((f) => `${f.bundle}${f.slug ? "" : " (global)"}`);
    const propias = b1.filter((f) => (f.glosses as Record<string, unknown>)?.[w]).map((f) => f.slug || "(global)");
    console.log(`  ${w}\n    B1: ${propias.join(", ")}\n    fuera: ${[...new Set(donde)].slice(0, 6).join(", ") || "en ningún otro bundle"}`);
  }
  await p.$disconnect();
})();
