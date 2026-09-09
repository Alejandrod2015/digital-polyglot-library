/**
 * QUE APARATO USA CADA PERSONA.
 *
 *   npx tsx scripts/dispositivos.ts             # una fila por aparato
 *   npx tsx scripts/dispositivos.ts --modelos   # recuento por modelo
 *
 * Sale de `dp_mobile_devices_v1`, que se llena solo con las cabeceras que la
 * app manda en cada llamada. Antes de esto, el modelo solo existia si la
 * persona abria la hoja de feedback, y Play Console solo lo daba por agregado.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

function dia(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function main() {
  const porModelo = process.argv.includes("--modelos");
  const filas = await prisma.mobileDevice.findMany({
    orderBy: { lastSeenAt: "desc" },
  });

  if (filas.length === 0) {
    console.log("Sin filas todavia. La tabla se llena cuando la app con las");
    console.log("cabeceras nuevas llega a las tiendas: no hay OTA.");
    return;
  }

  if (porModelo) {
    const cuenta = new Map<string, Set<string>>();
    for (const f of filas) {
      const k = `${f.platform}  ${f.model || "(sin modelo)"}`;
      if (!cuenta.has(k)) cuenta.set(k, new Set());
      cuenta.get(k)!.add(f.userId);
    }
    console.log("PERSONAS  APARATO");
    for (const [k, users] of [...cuenta].sort((a, b) => b[1].size - a[1].size)) {
      console.log(`${String(users.size).padStart(8)}  ${k}`);
    }
    return;
  }

  console.log("USUARIO                              PLAT     APARATO                 SO                  APP        VISTO");
  for (const f of filas) {
    console.log(
      [
        f.userId.padEnd(36),
        f.platform.padEnd(8),
        (f.model || "-").padEnd(23),
        (f.osVersion || "-").padEnd(19),
        `${f.appVersion || "-"}${f.buildNumber ? ` (${f.buildNumber})` : ""}`.padEnd(10),
        dia(f.lastSeenAt),
      ].join(" ")
    );
  }
  console.log(`\n${filas.length} aparatos, ${new Set(filas.map((f) => f.userId)).size} personas.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
