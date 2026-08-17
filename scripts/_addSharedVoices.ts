import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
const KEY = process.env.ELEVENLABS_API_KEY || process.env.ELEVEN_API_KEY || "";
const ADD: { name: string; owner: string; voiceId: string }[] = [
  { name: "carito",    owner: "66ce2679115600b9fd12b06aa934c95e301231987a77891bdb9e94d7d9544b38", voiceId: "J8BF9c7OgbHiqagCNoEj" },
  { name: "catalina",  owner: "0506ae525c72914fda23a0e7816b81e1f00ba7ba28a111b4c9c41ff8f52567e0", voiceId: "6Gr4AVmTax1pMJO0lHRK" },
  { name: "angela_cl", owner: "070ca4814b109ac3a70cb2278a234ac16242d7451bc0e8d1df049eaee9f16937", voiceId: "prblQcKOdF08ozhxP2mk" },
];
(async () => {
  if (!KEY) { console.log("NO KEY"); process.exit(1); }
  for (const v of ADD) {
    // already present?
    const chk = await fetch(`https://api.elevenlabs.io/v1/voices/${v.voiceId}`, { headers: { "xi-api-key": KEY } });
    if (chk.ok) { console.log(`  ${v.name} ${v.voiceId} YA en cuenta (200), skip`); continue; }
    const r = await fetch(`https://api.elevenlabs.io/v1/voices/add/${v.owner}/${v.voiceId}`, {
      method: "POST",
      headers: { "xi-api-key": KEY, "content-type": "application/json" },
      body: JSON.stringify({ new_name: v.name }),
    });
    const body = await r.text();
    console.log(`  ${v.name} ${v.voiceId} -> ${r.status} ${body.slice(0, 200)}`);
  }
  // re-verify
  console.log("\nRe-verificación:");
  for (const v of ADD) {
    const r = await fetch(`https://api.elevenlabs.io/v1/voices/${v.voiceId}`, { headers: { "xi-api-key": KEY } });
    console.log(`  ${v.name} ${v.voiceId} [${r.status}]`);
  }
})();
