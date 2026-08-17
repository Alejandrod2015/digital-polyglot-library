import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import crypto from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { getPublicObjectUrl, uploadPublicObject } from "../src/lib/objectStorage";
const JHENNY = "FXGrCtY3PEyfqczBAlqm";
const CLIP_VERSION = "v4";
const PILOT: Array<[string, string]> = [
  ["ana-es-la-guia", "sonreír"], ["el-mercado-picante", "gente"], ["ana-es-la-guia", "esto"],
  ["el-mercado-picante", "decir"], ["ana-es-la-guia", "feliz"], ["el-mercado-picante", "picante"],
  ["la-llamada", "próximo"], ["la-noche-sin-luz", "vieja"], ["quien-escribio-este-libro", "vender"],
  ["el-micro-del-domingo", "esperar"], ["el-micro-del-domingo", "intentar"], ["un-perro-bajo-la-lluvia", "aguacero"],
  ["el-ladron-de-mangos", "cabeza"], ["la-vigilancia", "calla"], ["sabado-de-mercado", "barato"],
  ["otra-vez-al-mercado", "le gusta"],
];
const strip = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
(async () => {
  for (const [slug, word] of PILOT) {
    const path = `scripts/_sets/${slug}.json`;
    const exs = JSON.parse(readFileSync(path, "utf8"));
    const e = exs.find((x: any) => strip(x.word || "") === strip(word));
    if (!e) { console.log(`SKIP ${slug}/${word}: no encontrado`); continue; }
    const file = `public/_practice-clips/${slug}__${strip(word).replace(/\s+/g, "-")}__t1.mp3`;
    const hash = crypto.createHash("sha256").update(`${CLIP_VERSION}|${JHENNY}|${e.payload.audioClip.sentence}`).digest("hex").slice(0, 16);
    const key = `media/practice/sentence-clip/${hash}.mp3`;
    await uploadPublicObject({ key, body: readFileSync(file), contentType: "audio/mpeg" });
    e.payload.audioClip.clipUrl = getPublicObjectUrl(key);
    writeFileSync(path, JSON.stringify(exs, null, 2) + "\n");
    console.log(`✓ ${slug}/${word}`);
  }
})();
