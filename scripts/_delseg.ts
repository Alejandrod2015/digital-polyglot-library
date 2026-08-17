/** Borra UN segmento cacheado de R2 para forzar una toma nueva. Reversible:
 *  el próximo render lo regenera. Firma SigV4 igual que getPresignedPutUrl. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { createHash, createHmac } from "crypto";
const KEY = process.argv[2];
const hmac = (k: string | Buffer, d: string) => createHmac("sha256", k).update(d).digest();
(async () => {
  const ep = process.env.MEDIA_STORAGE_ENDPOINT!.replace(/\/+$/, "");
  const bucket = process.env.MEDIA_STORAGE_BUCKET!;
  const region = process.env.MEDIA_STORAGE_REGION || "auto";
  const url = new URL(`${ep}/${bucket}/${KEY}`);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const scope = `${dateStamp}/${region}/s3/aws4_request`;
  const q = [["X-Amz-Algorithm","AWS4-HMAC-SHA256"],["X-Amz-Credential",`${process.env.MEDIA_STORAGE_ACCESS_KEY_ID}/${scope}`],
             ["X-Amz-Date",amzDate],["X-Amz-Expires","300"],["X-Amz-SignedHeaders","host"]]
    .sort((a,b)=>a[0].localeCompare(b[0])).map(([k,v])=>`${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
  const canonical = ["DELETE", url.pathname, q, `host:${url.host}\n`, "host", "UNSIGNED-PAYLOAD"].join("\n");
  const sts = ["AWS4-HMAC-SHA256", amzDate, scope, createHash("sha256").update(canonical).digest("hex")].join("\n");
  const signing = hmac(hmac(hmac(hmac(`AWS4${process.env.MEDIA_STORAGE_SECRET_ACCESS_KEY}`, dateStamp), region), "s3"), "aws4_request");
  const sig = createHmac("sha256", signing).update(sts).digest("hex");
  const r = await fetch(`${url.origin}${url.pathname}?${q}&X-Amz-Signature=${sig}`, { method: "DELETE" });
  console.log("DELETE:", r.status);
  const h = await fetch(`https://pub-ef067ab826f24d8fbe43b2ac2469bd3a.r2.dev/${KEY}`, { method: "HEAD" });
  console.log("HEAD ahora:", h.status, h.status === 404 ? "(borrado)" : "(sigue)");
})();
