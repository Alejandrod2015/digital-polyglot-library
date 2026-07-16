import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import * as fs from "fs";
const KEY=process.env.ELEVENLABS_API_KEY!;
const S={stability:0.4,similarity_boost:0.8,style:0.3,speed:0.9,use_speaker_boost:true};
const soften=(t:string)=>t.replace(/!+/g,".").replace(/\.{2,}/g,".");
const TESTS=[
 {name:"alt-Nayeli-Fernanda", voice:"ARmPWZKt7WpXh6QDHA6x", line:"No seas codo con él, a mí me laten sus refranes."},
 {name:"alt-Flor-Malena", voice:"p7AwDmKvTdoHTBuueGvP", line:"Es un bardo, Tomás. El chabón es un careta total, puro chamuyo."},
 {name:"alt-Nico-Leo", voice:"SP7u64pfm3Zy7bOSVodG", line:"Pará, más despacio, ¿qué weón, qué wea? No te entiendo absolutamente ni una palabra."},
];
(async()=>{
 for(const t of TESTS){
  const r=await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${t.voice}`,{method:"POST",headers:{"xi-api-key":KEY,"content-type":"application/json"},body:JSON.stringify({text:soften(t.line),model_id:"eleven_multilingual_v2",voice_settings:S})});
  if(!r.ok){ console.log("FAIL",t.name,r.status,(await r.text()).slice(0,120)); continue; }
  const buf=Buffer.from(await r.arrayBuffer());
  fs.writeFileSync(`public/_friends-voicetest/${t.name}.mp3`,buf);
  console.log("ok",t.name,buf.length,"bytes");
 }
})();
