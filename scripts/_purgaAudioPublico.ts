import { config } from "dotenv";
config({ path: ".env.local" });

import {
  deletePublicObject,
  getPrivateBucketName,
  getPublicBucketName,
  listPrivateObjects,
  listPublicObjects,
} from "../src/lib/objectStorage";
import { SIGNED_AUDIO_PREFIXES, isSignableAudioKey } from "../src/lib/mediaSigning";

/**
 * Borra el audio del bucket PUBLICO. Es el ultimo paso de la tanda de URLs
 * firmadas y es IRREVERSIBLE: aqui mueren las URLs permanentes que ya se
 * hayan filtrado, y con ellas cualquier enlace viejo que siga por ahi.
 *
 * NO se corre hasta la fase 4 (a los 14 dias del corte). Antes de borrar:
 *
 *   1. scripts/_copiaAudioPrivado.ts tiene que cuadrar los conteos.
 *   2. MEDIA_SIGNED_AUDIO tiene que llevar dias encendido en produccion.
 *   3. Las apps de TIENDA de iOS y Android tienen que reproducir bien.
 *
 * Uso:
 *   npx tsx scripts/_purgaAudioPublico.ts                 (solo enumera)
 *   npx tsx scripts/_purgaAudioPublico.ts --confirmar-borrado
 *
 * Sin la bandera no borra ni un archivo. Y antes de borrar cada prefijo
 * comprueba que ESE prefijo esta completo en el bucket privado: si falta algo,
 * para en seco. Borrar lo que no se copio es perder el audio.
 */

const BANDERA = "--confirmar-borrado";

async function listarTodo(
  listar: (prefix: string, token: string | null) => Promise<{ keys: string[]; nextToken: string | null }>,
  prefijo: string
): Promise<string[]> {
  const keys: string[] = [];
  let token: string | null = null;
  do {
    const page = await listar(prefijo, token);
    // Mismo filtro que el firmador: bajo media/polyglot/ y media/standalone/
    // tambien viven las portadas, y esas siguen publicas a proposito.
    keys.push(...page.keys.filter(isSignableAudioKey));
    token = page.nextToken;
  } while (token);
  return keys;
}

async function main() {
  const confirmado = process.argv.includes(BANDERA);

  const publico = getPublicBucketName();
  const privado = getPrivateBucketName();
  if (!publico || !privado) {
    console.error("Falta configuracion de MEDIA_STORAGE_*. Nada que hacer.");
    process.exit(1);
  }
  if (publico === privado) {
    console.error(
      `MEDIA_PRIVATE_BUCKET no esta puesto: se estaria borrando el unico bucket que hay (${publico}).`
    );
    process.exit(1);
  }

  console.log(`Bucket a purgar: ${publico}`);
  console.log(`Respaldo en    : ${privado}`);
  if (!confirmado) {
    console.log(`\nModo enumerar. Para borrar de verdad: npx tsx scripts/_purgaAudioPublico.ts ${BANDERA}\n`);
  } else {
    console.log("\nMODO BORRADO. Esto es irreversible.\n");
  }

  let totalBorrados = 0;
  let totalFallos = 0;

  for (const prefijo of SIGNED_AUDIO_PREFIXES) {
    const enPublico = await listarTodo(listPublicObjects, prefijo);
    const enPrivado = new Set(await listarTodo(listPrivateObjects, prefijo));
    const sinCopiar = enPublico.filter((key) => !enPrivado.has(key));

    if (sinCopiar.length > 0) {
      console.error(
        `${prefijo}: ${sinCopiar.length} de ${enPublico.length} NO estan en el privado. Se para aqui.`
      );
      console.error(`  ejemplo: ${sinCopiar[0]}`);
      process.exit(1);
    }

    if (!confirmado) {
      console.log(`${prefijo}: ${enPublico.length} archivos se borrarian`);
      continue;
    }

    let borrados = 0;
    let fallos = 0;
    for (const key of enPublico) {
      try {
        await deletePublicObject(key);
        borrados += 1;
      } catch (err) {
        fallos += 1;
        console.error(`  fallo ${key}: ${err instanceof Error ? err.message : err}`);
      }
    }
    totalBorrados += borrados;
    totalFallos += fallos;
    console.log(`${prefijo}: ${borrados} borrados, ${fallos} fallos`);
  }

  if (confirmado) {
    console.log(`\nTotal: ${totalBorrados} borrados, ${totalFallos} fallos`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
