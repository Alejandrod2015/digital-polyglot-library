/**
 * Sube un archivo a R2 y devuelve su URL publica.
 *
 * Existe porque el usuario revisa audio y paginas de audicion por LINK
 * CLICABLE, nunca por tarjeta de descarga (ver memoria: audition links
 * clickable / voice audition inline player).
 *
 *   npx tsx scripts/_uploadPage.ts <archivo> <nombre> [contentType]
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { readFileSync } from "fs";
import path from "path";
import { uploadPublicObject } from "../src/lib/objectStorage";

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".json": "application/json",
};

async function main() {
  const [file, name, explicitType] = process.argv.slice(2);
  if (!file || !name) throw new Error("uso: _uploadPage.ts <archivo> <nombre> [contentType]");
  const ext = path.extname(file).toLowerCase();
  const contentType = explicitType || TYPES[ext] || "application/octet-stream";
  const res = await uploadPublicObject({
    key: `media/review/${name}${ext}`,
    body: readFileSync(file),
    contentType,
    cacheControl: "public, max-age=300",
  });
  if (!res) throw new Error("almacenamiento no configurado (faltan credenciales R2)");
  console.log(res.url);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
