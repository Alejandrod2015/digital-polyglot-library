import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import * as fs from "fs";
const KEY=process.env.ELEVENLABS_API_KEY!;
const S={stability:0.4,similarity_boost:0.8,style:0.3,speed:0.9,use_speaker_boost:true};
const ANDRETI="JW8DGEuLp9WxIS5IdxMM";
const TITLE="La cuenta del jueves";
const soften=(t:string)=>t.replace(/!+/g,".").replace(/\.{2,}/g,".");
(async()=>{
 const body=fs.readFileSync("scripts/_friendsNarratorPilot.txt","utf8").replace(/\s+/g," ").trim();
 const titleP=/[.!?…:]$/.test(TITLE)?TITLE:`${TITLE}.`;
 const narration=soften(`${titleP}\n\n${body}`);
 const r=await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ANDRETI}`,{method:"POST",headers:{"xi-api-key":KEY,"content-type":"application/json"},body:JSON.stringify({text:narration,model_id:"eleven_multilingual_v2",voice_settings:S})});
 if(!r.ok){ console.log("FAIL",r.status,(await r.text()).slice(0,150)); return; }
 const buf=Buffer.from(await r.arrayBuffer());
 fs.writeFileSync("public/_friends-voicetest/narrator-pilot-andreti.mp3",buf);
 console.log("ok narrator sample WITH title",buf.length,"bytes");
})();
