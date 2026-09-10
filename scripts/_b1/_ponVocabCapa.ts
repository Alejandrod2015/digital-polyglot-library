// Scratch: pone en la capa de UNA historia la entrada de un vocab de varias palabras
// (la clave es el lema, como "salir las cuentas"), y la global si falta.
// Uso: _ponVocabCapa.ts <slug> <clave> <g> <t> <trozo es> <trozo en>
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";

const B = "spanish-traveler-spain-b1";
(async () => {
  const [slug, clave, g, t, es, en] = process.argv.slice(2);
  const p = new PrismaClient();
  const glob = (await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: B, slug: "" } } }))!;
  const gg = glob.glosses as Record<string, unknown>;
  if (!gg[clave]) {
    gg[clave] = { g, t, rev: true };
    await p.tapGlossSet.update({ where: { bundle_slug: { bundle: B, slug: "" } }, data: { glosses: gg as never } });
    console.log(`global ${clave}: ${g}`);
  }
  const fila = (await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: B, slug } } }))!;
  const capa = fila.glosses as Record<string, unknown>;
  capa[clave] = { g, t, c: { es, en }, rev: true };
  await p.tapGlossSet.update({ where: { bundle_slug: { bundle: B, slug } }, data: { glosses: capa as never } });
  console.log(`${slug} · ${clave}: "${es}" = ${en}`);
  await p.$disconnect();
})();
