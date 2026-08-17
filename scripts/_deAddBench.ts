import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
const KEY = process.env.ELEVENLABS_API_KEY!;
const PICKS: Array<[string, string]> = [
  ["MMwckqU477oQxnAk1SgA", "Bench DE - Ben"],
  ["vmVmHDKBkkCgbLVIOJRb", "Bench DE - Charlie"],
  ["NE7AIW5DoJ7lUosXV2KR", "Bench DE - Ela Cheerful"],
];
(async () => {
  const all = new Map<string, any>();
  for (const params of ["language=de&use_cases=narrative_story&page_size=100", "language=de&use_cases=conversational&page_size=100"]) {
    const r = await fetch(`https://api.elevenlabs.io/v1/shared-voices?${params}`, { headers: { "xi-api-key": KEY } });
    for (const v of ((await r.json()) as any).voices || []) all.set(v.voice_id, v);
  }
  for (const [id, name] of PICKS) {
    const v = all.get(id);
    console.log(`${name}: category=${v.category} | notice_period=${v.notice_period ?? "none"} | free_users_allowed=${v.free_users_allowed} | rate=${v.rate ?? "-"}`);
    const add = await fetch(`https://api.elevenlabs.io/v1/voices/add/${v.public_owner_id}/${id}`, {
      method: "POST", headers: { "xi-api-key": KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ new_name: name }),
    });
    console.log(`  add: ${add.status}`);
  }
})();
