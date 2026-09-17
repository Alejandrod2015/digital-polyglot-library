import { config } from "dotenv";
config({ path: ".env.local" });

import {
  copyObjectToPrivateBucket,
  getPrivateBucketName,
  getPublicBucketName,
  listPrivateObjects,
  listPublicObjects,
} from "../src/lib/objectStorage";
import { SIGNED_AUDIO_PREFIXES, isSignableAudioKey } from "../src/lib/mediaSigning";

/**
 * Copia el audio del bucket PUBLICO al PRIVADO, prefijo por prefijo.
 *
 * Los bytes no pasan por aqui: es un CopyObject de S3 dentro de la misma
 * cuenta de R2. Es idempotente, asi que se puede correr las veces que haga
 * falta; al final compara el conteo de origen con el de destino.
 *
 *   npx tsx scripts/_copiaAudioPrivado.ts --dry
 *   npx tsx scripts/_copiaAudioPrivado.ts
 *
 * NO borra nada. La purga del bucket publico es otro script y otra fase.
 */

type Conteo = { prefijo: string; origen: number; copiados: number; yaEstaban: number; fallos: number };

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
  const dry = process.argv.includes("--dry");

  const publico = getPublicBucketName();
  const privado = getPrivateBucketName();
  if (!publico || !privado) {
    console.error("Falta configuracion de MEDIA_STORAGE_*. Nada que hacer.");
    process.exit(1);
  }
  if (publico === privado) {
    console.error(
      `MEDIA_PRIVATE_BUCKET no esta puesto: origen y destino serian el mismo bucket (${publico}).`
    );
    process.exit(1);
  }

  console.log(`Origen : ${publico}`);
  console.log(`Destino: ${privado}`);
  console.log(dry ? "Modo   : --dry (no copia nada)\n" : "Modo   : copia real\n");

  const conteos: Conteo[] = [];

  for (const prefijo of SIGNED_AUDIO_PREFIXES) {
    const origen = await listarTodo(listPublicObjects, prefijo);
    const destino = new Set(await listarTodo(listPrivateObjects, prefijo));

    let copiados = 0;
    let fallos = 0;
    const yaEstaban = origen.filter((key) => destino.has(key)).length;

    for (const key of origen) {
      if (destino.has(key)) continue;
      if (dry) {
        copiados += 1;
        continue;
      }
      try {
        await copyObjectToPrivateBucket(key);
        copiados += 1;
      } catch (err) {
        fallos += 1;
        console.error(`  fallo ${key}: ${err instanceof Error ? err.message : err}`);
      }
    }

    conteos.push({ prefijo, origen: origen.length, copiados, yaEstaban, fallos });
    console.log(
      `${prefijo}: ${origen.length} en origen, ${yaEstaban} ya estaban, ${copiados} ${dry ? "por copiar" : "copiados"}, ${fallos} fallos`
    );
  }

  console.log("\nConteo final origen vs destino");
  let ok = true;
  for (const c of conteos) {
    const destino = dry
      ? c.yaEstaban
      : (await listarTodo(listPrivateObjects, c.prefijo)).length;
    const igual = destino >= c.origen;
    if (!igual) ok = false;
    console.log(`  ${c.prefijo}: origen ${c.origen} / destino ${destino} ${igual ? "ok" : "FALTAN"}`);
  }

  if (!ok && !dry) {
    console.error("\nHay prefijos incompletos. NO se pasa a la purga hasta que cuadren.");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
