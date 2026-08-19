// Sesión LOCAL para el simulador: firma un token de móvil con el secreto de
// desarrollo y lo imprime. Sirve SOLO contra el servidor local; producción
// firma con otro secreto y lo rechaza. Repite el formato de
// `createMobileSessionToken` (src/lib/mobileSession.ts) sin importarlo, porque
// ese módulo arrastra prisma y prisma es server-only.
import { createHmac } from "crypto";

const secret = process.env.MOBILE_AUTH_SECRET?.trim() || process.env.CLERK_SECRET_KEY?.trim() || "";
if (!secret) throw new Error("Falta MOBILE_AUTH_SECRET o CLERK_SECRET_KEY");

const b64 = (v: string) => Buffer.from(v, "utf8").toString("base64url");
const iat = Math.floor(Date.now() / 1000);
const payload = {
  aud: "digital-polyglot-mobile",
  sub: process.argv[3] ?? "user_local_simulator_qa",
  email: process.argv[2] ?? "delcarpio321@gmail.com",
  name: null,
  plan: "owner",
  targetLanguages: [] as string[],
  booksCount: 0,
  storiesCount: 0,
  iat,
  exp: iat + 60 * 60 * 24,
};
const unsigned = `${b64(JSON.stringify({ alg: "HS256", typ: "JWT" }))}.${b64(JSON.stringify(payload))}`;
console.log(`${unsigned}.${createHmac("sha256", secret).update(unsigned).digest("base64url")}`);
