import "./_loadEnv";
(async()=>{
  const r = await fetch("https://api.elevenlabs.io/v1/user/subscription", { headers:{ "xi-api-key": process.env.ELEVENLABS_API_KEY! } });
  const j:any = await r.json();
  console.log(`cuota: ${j.character_count} / ${j.character_limit} -> quedan ${j.character_limit - j.character_count}`);
})();
