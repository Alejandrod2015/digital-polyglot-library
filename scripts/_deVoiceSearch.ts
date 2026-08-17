import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
const KEY = process.env.ELEVENLABS_API_KEY!;
const POOL = new Set(["Ww7Sq9tx9CCOiNOwWgsx","WHaUUVTDq47Yqc9aDbkH","KSEa36Zojh7KLdIkb8Qu","8SdTD5IMgFKT1jp7JbPC","e3bIMyLemdwvh75g9Vpt","SJJe86Va82zRzg6zi2dX","hOBDmVrVUuqtp1I3KsIq","IQuqJPpP2hMHjjDY2QTe","JDXBO1etYlVlJZRMoYzH","wcqN36SUOZ0EhToc2OIu","wZUI6Qb377V1PsC35d6y","9iYBWBbTzTDIt6imiMxp","KVgqk9YVh0pWUJiWQN8j","2EkqFDbWjmOn56BMSmts","MTTjXkEpZepLTqO0xH0f"]);
const BANNED = new Set(["qVRpsZJDV29g1CIPzssm","cllvQaMvj0ZKxH88HGEn","mmAbrxFQ9xjByXyBpqrK"]);
const BAD = /cartoon|anime|fantasy|character|gam(e|ing)|robot|witch|monster|santa|demon|child|kid|grandma|grandpa|elderly|old man|old woman/i;
(async () => {
  const all = new Map<string, any>();
  for (const params of [
    "language=de&use_cases=narrative_story&page_size=100",
    "language=de&use_cases=conversational&page_size=100",
  ]) {
    const r = await fetch(`https://api.elevenlabs.io/v1/shared-voices?${params}`, { headers: { "xi-api-key": KEY } });
    for (const v of ((await r.json()) as any).voices || []) all.set(v.voice_id, v);
  }
  const ranked = [...all.values()]
    .filter((v) => !POOL.has(v.voice_id) && !BANNED.has(v.voice_id) && v.preview_url)
    .filter((v) => !BAD.test(`${v.name} ${v.description || ""}`))
    .filter((v) => v.age !== "old")
    .sort((a, b) => (b.cloned_by_count || 0) - (a.cloned_by_count || 0));
  for (const v of ranked.slice(0, 25))
    console.log(JSON.stringify({ id: v.voice_id, name: v.name, g: v.gender, age: v.age, use: v.use_case, cloned: v.cloned_by_count, desc: (v.description || "").slice(0, 70) }));
})();
