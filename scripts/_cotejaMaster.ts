/** Coteja lo que DICE el master (STT) con el texto guardado: sobras y faltas. */
import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
const norm = (s:string) => s.normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9\s]/gi," ").replace(/\s+/g," ").trim().toLowerCase();
(async () => {
  for (const slug of process.argv.slice(2)) {
    const s = await prisma.journeyStory.findFirst({ where: { slug }, select: { title:true, text:true, audioUrl:true } });
    if (!s?.audioUrl) { console.log(`${slug}: sin audio`); continue; }
    const buf = Buffer.from(await (await fetch(s.audioUrl)).arrayBuffer());
    const fd = new FormData();
    fd.append("model_id","scribe_v1"); fd.append("language_code","spa"); fd.append("timestamps_granularity","word");
    fd.append("file", new Blob([new Uint8Array(buf)], { type:"audio/mpeg" }), "s.mp3");
    const r = await fetch("https://api.elevenlabs.io/v1/speech-to-text", { method:"POST", headers:{"xi-api-key":process.env.ELEVENLABS_API_KEY!}, body:fd });
    const oido = norm(String(((await r.json()) as any).text ?? "")).split(" ");
    const esperado = norm(`${s.title}. ${s.text}`).split(" ");
    // Alineacion LCS: lo que sobra en el audio es lo que dejo una costura.
    const n = esperado.length, m = oido.length;
    const dp = Array.from({length:n+1},()=>new Int32Array(m+1));
    for (let i=n-1;i>=0;i--) for (let j=m-1;j>=0;j--)
      dp[i][j] = esperado[i]===oido[j] ? dp[i+1][j+1]+1 : Math.max(dp[i+1][j], dp[i][j+1]);
    const sobra:string[]=[], falta:string[]=[];
    let i=0,j=0;
    while(i<n&&j<m){ if(esperado[i]===oido[j]){i++;j++;} else if(dp[i+1][j]>=dp[i][j+1]){falta.push(esperado[i++]);} else {sobra.push(oido[j++]);} }
    while(i<n) falta.push(esperado[i++]); while(j<m) sobra.push(oido[j++]);
    console.log(`${slug}: ${dp[0][0]}/${n} palabras coinciden · sobran ${sobra.length} · faltan ${falta.length}`);
    if (sobra.length) console.log(`   sobra en el audio: ${sobra.join(" ")}`);
    if (falta.length) console.log(`   no se oye: ${falta.join(" ")}`);
  }
  await prisma.$disconnect();
})();
