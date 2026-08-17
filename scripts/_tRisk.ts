import { riesgos } from "../scripts/_textRiskAudio";
const casos = [
 ["CONFIRMADA", "Bia sobe a escada e acha um banco vazio de frente para a janela."],
 ["CONFIRMADA", "Tiago atravessa a areia com passos rápidos até chegar lá."],
 ["CONFIRMADA", "Tiago passa no quiosque, senta ao lado e ajuda a encher o balde."],
 ["CONFIRMADA", "No fim da rua, uma escada larga aparece cheia de azulejos coloridos."],
 ["CONFIRMADA", "Lá em cima, o vento bate forte e o barulho da cidade fica para trás."],
 ["SANA      ", "Tiago não entende por que a pedra inteira fica em silêncio."],
 ["SANA      ", "A pedra do Arpoador fica cheia de gente no fim da tarde."],
];
for (const [tipo, f] of casos) { const r = riesgos(f); console.log(`${tipo} ${r.length ? "⚠ " + r.map(x=>`«${x}»`).join(" · ") : "· limpia"}`); }
