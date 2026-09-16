import { readFileSync, writeFileSync } from "node:fs";
const cl = JSON.parse(readFileSync("scripts/_oido-clave.json","utf8"));
// La pagina NO lleva el grupo ni la pendiente: es una prueba a ciegas.
const filas = cl.map((c:any) => `
<div class="c" data-n="${c.n}">
  <div class="hd"><span class="n">${c.n}</span><span class="w">${c.word}</span></div>
  <audio controls preload="none" src="${c.url}"></audio>
  <div class="bt">
    <button data-v="pregunta">suena a pregunta</button>
    <button data-v="bien">suena bien</button>
  </div>
</div>`).join("");
const html = `<!doctype html><meta charset="utf-8"><title>Oido: nueve palabras</title>
<style>body{font:16px/1.6 -apple-system,system-ui,sans-serif;margin:24px auto;max-width:720px;color:#1a1a1a}
h1{font-size:21px;margin-bottom:4px}p.i{color:#555;font-size:15px;margin-top:0}
.c{border:1px solid #e3e3e3;border-radius:8px;padding:12px 14px;margin:10px 0}
.hd{display:flex;align-items:baseline;gap:10px}.n{color:#999;font-size:13px}.w{font-weight:600;font-size:17px}
audio{width:100%;height:34px;margin:8px 0}
.bt{display:flex;gap:8px}button{flex:1;padding:9px;border:1px solid #ccc;background:#fafafa;border-radius:6px;font:inherit;font-size:14px;cursor:pointer}
button.on[data-v=pregunta]{background:#ffe8e8;border-color:#e08080;font-weight:600}
button.on[data-v=bien]{background:#e8f6e8;border-color:#7fb87f;font-weight:600}
#out{width:100%;height:90px;font:13px ui-monospace,monospace;margin-top:14px;padding:8px}
.done{background:#f4f4f4;padding:10px 14px;border-radius:6px;font-size:15px}</style>
<h1>Nueve palabras, a ciegas</h1>
<p class="i">Escucha cada una y di solo si te suena a pregunta o te suena bien. No hay orden ni pista: tres deberian estar bien y las otras no, pero no sabes cuales. Cuando marques las nueve, copia el resultado de abajo y pegamelo.</p>
${filas}
<div class="done" id="est">0 de 9 marcadas</div>
<textarea id="out" readonly placeholder="Aqui sale el resultado cuando marques las nueve"></textarea>
<script>
const R={};
document.querySelectorAll(".c").forEach(c=>{
  c.querySelectorAll("button").forEach(b=>b.onclick=()=>{
    c.querySelectorAll("button").forEach(x=>x.classList.remove("on"));
    b.classList.add("on"); R[c.dataset.n]=b.dataset.v; pinta();
  });
});
function pinta(){
  const k=Object.keys(R).length;
  document.getElementById("est").textContent=k+" de 9 marcadas";
  if(k===9){
    document.getElementById("out").value="oido: "+[...Array(9)].map((_,i)=>(i+1)+"="+R[i+1]).join(" ");
  }
}
try{const s=JSON.parse(localStorage.getItem("oido9")||"{}");Object.assign(R,s);
  document.querySelectorAll(".c").forEach(c=>{const v=R[c.dataset.n];
    if(v)c.querySelector('button[data-v="'+v+'"]').classList.add("on")});pinta();}catch(e){}
addEventListener("click",()=>{try{localStorage.setItem("oido9",JSON.stringify(R))}catch(e){}});
</script>`;
writeFileSync("public/_oido-nueve.html", html);
console.log("public/_oido-nueve.html");
