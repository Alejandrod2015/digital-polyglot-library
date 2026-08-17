// Lista los másters de audio en R2 y su fecha, para poder volver al anterior.
// Firma SigV4 a mano, igual que objectStorage.ts. Solo lee (ListObjectsV2).
import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { createHash, createHmac } from "crypto";

const endpoint = (process.env.MEDIA_STORAGE_ENDPOINT ?? "").replace(/\/$/, "");
const bucket = process.env.MEDIA_STORAGE_BUCKET ?? "";
const ak = process.env.MEDIA_STORAGE_ACCESS_KEY_ID ?? "";
const sk = process.env.MEDIA_STORAGE_SECRET_ACCESS_KEY ?? "";
const region = process.env.MEDIA_STORAGE_REGION ?? "auto";
if (!endpoint || !bucket || !ak || !sk) throw new Error("faltan credenciales de almacenamiento");

const sha = (s: string | Buffer) => createHash("sha256").update(s).digest("hex");
const hmac = (k: Buffer | string, d: string) => createHmac("sha256", k).update(d).digest();

async function list(prefix: string, token?: string) {
  const host = new URL(endpoint).host;
  const now = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const date = now.slice(0, 8);
  const qs = new URLSearchParams({ "list-type": "2", prefix, "max-keys": "1000" });
  if (token) qs.set("continuation-token", token);
  const canonicalQs = [...qs.entries()].sort().map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
  const payload = sha("");
  const canonical = ["GET", `/${bucket}`, canonicalQs, `host:${host}\nx-amz-content-sha256:${payload}\nx-amz-date:${now}\n`, "host;x-amz-content-sha256;x-amz-date", payload].join("\n");
  const scope = `${date}/${region}/s3/aws4_request`;
  const toSign = ["AWS4-HMAC-SHA256", now, scope, sha(canonical)].join("\n");
  const key = hmac(hmac(hmac(hmac(`AWS4${sk}`, date), region), "s3"), "aws4_request");
  const sig = createHmac("sha256", key).update(toSign).digest("hex");
  const auth = `AWS4-HMAC-SHA256 Credential=${ak}/${scope}, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=${sig}`;
  const r = await fetch(`${endpoint}/${bucket}?${canonicalQs}`, { headers: { host, "x-amz-date": now, "x-amz-content-sha256": payload, authorization: auth } });
  const cuerpo = await r.text();
  if (!r.ok) throw new Error(`list ${r.status}: ${cuerpo.slice(0, 300)}`);
  if (process.env.DPL_DEBUG) console.error("XML:", cuerpo.slice(0, 400));
  return cuerpo;
}

(async () => {
  const filtro = process.argv[2] ?? "";
  let token: string | undefined; const filas: Array<[string, string]> = [];
  do {
    const xml = await list(process.env.DPL_PREFIX ?? "", token);
    for (const m of xml.matchAll(/<Key>([^<]+)<\/Key>(?:(?!<\/Contents>)[\s\S])*?<LastModified>([^<]+)<\/LastModified>/g)) {
      if (!filtro || m[1].includes(filtro)) filas.push([m[2], m[1]]);
    }
    token = (xml.match(/<NextContinuationToken>([^<]+)</) ?? [])[1];
  } while (token);
  filas.sort();
  for (const [fecha, key] of filas) console.log(`${fecha}  ${key}`);
  console.log(`\n${filas.length} ficheros`);
})().catch(e => { console.error("FALLÓ:", e.message); process.exit(1); });
