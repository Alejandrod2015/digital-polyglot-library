import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { createHash, createHmac } from "crypto";
import { PrismaClient } from "../../src/generated/prisma";

const KEY = "media/generated/audio/Kabeljau_vom_Fischmarkt_multivoice_1781603602052_atempo0.94_1781603606056.mp3";
const NAME = "Kabeljau_vom_Fischmarkt_multivoice_1781603602052_atempo0.94_1781603606056.mp3";

const env = (n: string) => (process.env[n]?.trim() ?? "");
const endpoint = env("MEDIA_STORAGE_ENDPOINT").replace(/\/+$/, "");
const bucket = env("MEDIA_STORAGE_BUCKET");
const ak = env("MEDIA_STORAGE_ACCESS_KEY_ID");
const sk = env("MEDIA_STORAGE_SECRET_ACCESS_KEY");
const region = env("MEDIA_STORAGE_REGION") || "auto";
const hex = (v: string | Buffer) => createHash("sha256").update(v).digest("hex");
const hmac = (k: Buffer | string, v: string) => createHmac("sha256", k).update(v).digest();
const encKey = (k: string) => k.split("/").filter(Boolean).map(encodeURIComponent).join("/");

function signed(method: "DELETE" | "HEAD", url: URL): Headers {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = hex("");
  const h = new Headers({ host: url.host, "x-amz-content-sha256": payloadHash, "x-amz-date": amzDate });
  const entries = Array.from(h.entries()).sort(([a], [b]) => a.localeCompare(b));
  const canonicalHeaders = entries.map(([n, v]) => `${n}:${v.trim()}\n`).join("");
  const signedHeaders = entries.map(([n]) => n).join(";");
  const canonical = [method, url.pathname, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const scope = `${dateStamp}/${region}/s3/aws4_request`;
  const sts = ["AWS4-HMAC-SHA256", amzDate, scope, hex(canonical)].join("\n");
  const key = hmac(hmac(hmac(hmac(`AWS4${sk}`, dateStamp), region), "s3"), "aws4_request");
  const sig = createHmac("sha256", key).update(sts).digest("hex");
  h.set("authorization", `AWS4-HMAC-SHA256 Credential=${ak}/${scope}, SignedHeaders=${signedHeaders}, Signature=${sig}`);
  return h;
}

(async () => {
  if (!endpoint || !bucket || !ak || !sk) { console.log("sin credenciales de MEDIA_STORAGE"); return; }
  // 1) nadie mas lo apunta
  const p = new PrismaClient();
  const refs = await p.journeyStory.count({
    where: { OR: [{ audioFilename: NAME }, { audioUrl: { contains: NAME } }, { audioFilenamePreview: NAME }, { audioUrlPreview: { contains: NAME } }] },
  });
  await p.$disconnect();
  console.log("filas de journeyStory que lo apuntan:", refs);
  if (refs > 0) { console.log("ABORTADO: sigue referenciado"); return; }

  const url = new URL(`${endpoint}/${encodeURIComponent(bucket)}/${encKey(KEY)}`);
  const before = await fetch(url, { method: "HEAD", headers: signed("HEAD", url) });
  console.log("HEAD antes:", before.status, before.headers.get("content-length") ?? "");
  if (before.status !== 200) { console.log("no existe o no accesible; nada que borrar"); return; }
  if (!process.argv.includes("--apply")) { console.log("(dry) no se borra"); return; }
  const del = await fetch(url, { method: "DELETE", headers: signed("DELETE", url) });
  console.log("DELETE:", del.status);
  const after = await fetch(url, { method: "HEAD", headers: signed("HEAD", url) });
  console.log("HEAD despues:", after.status);
})();
