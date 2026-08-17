import { riesgos } from "./_textRiskAudio";
const casos: Array<[string,string]> = [
 ["CIEGA-falló ", "A fila da padaria dobra a esquina na hora do almoço."],
 ["CIEGA-falló ", "Ele nem chega a perguntar o nome do moço."],
 ["CIEGA-acertó", "A padaria abre às seis e meia, e a rua ainda está escura."],
 ["yo marqué   ", "O caldo cai num balde de metal, doce e cheio de espuma."],
 ["confirmada  ", "Tiago atravessa a areia com passos rápidos até chegar lá."],
 ["confirmada  ", "senta ao lado e ajuda a encher o balde."],
 ["confirmada  ", "Bia sobe a escada e acha um banco vazio de frente para a janela."],
 ["sana        ", "Tiago não entende por que a pedra inteira fica em silêncio."],
 ["sana        ", "A pedra do Arpoador fica cheia de gente no fim da tarde."],
];
for (const [t,f] of casos) { const r=[...new Set(riesgos(f))]; console.log(`${t} ${r.length?"⚠ "+r.map(x=>`«${x}»`).join(" · "):"· limpia"}`); }
