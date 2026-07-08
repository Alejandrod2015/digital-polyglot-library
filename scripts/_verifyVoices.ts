import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
const VOICES: Record<string,string> = {
  moritz:"Ww7Sq9tx9CCOiNOwWgsx", ela_warm:"SJJe86Va82zRzg6zi2dX", marius:"JDXBO1etYlVlJZRMoYzH",
  ela_calm:"e3bIMyLemdwvh75g9Vpt", enniah:"WHaUUVTDq47Yqc9aDbkH", daien:"9iYBWBbTzTDIt6imiMxp",
  ela_cheer:"NE7AIW5DoJ7lUosXV2KR", ben_de:"MMwckqU477oQxnAk1SgA", charlie:"vmVmHDKBkkCgbLVIOJRb",
};
(async () => {
  const key = process.env.ELEVENLABS_API_KEY!;
  for (const [name,id] of Object.entries(VOICES)) {
    const r = await fetch(`https://api.elevenlabs.io/v1/voices/${id}`, { headers: { "xi-api-key": key } });
    const j:any = r.ok ? await r.json() : null;
    console.log(`${r.status===200?"✓":"✗"} ${r.status}  ${name.padEnd(10)} ${id}  ${j?.name??""}`);
  }
})();
