"""Los cuatro del tema 7.

El bloque final de la segunda llevaba siete plazas porque repetia "lampada" y
"cortina" del primero: el contador va por PRESENCIA en el bloque, asi que una
palabra repetida cuenta dos veces. Se cambian por sinonimos de escena y el
bloque baja a cinco sin perder nada.
"""
import json

RUTA = "scripts/_pta2T7.json"
d = json.load(open(RUTA, encoding="utf-8"))

for v in d[0]["vocab"]:
    if v["word"] == "levar":
        v["definition"] = "To carry something over to some other place."

d[1]["text"] = (
    d[1]["text"]
    .replace("Apaga a lâmpada às nove.", "Apaga a luz às nove.")
    .replace("No escuro a cortina amarela deixa passar uma faixa roxa,", "No escuro a janela amarela deixa passar uma faixa roxa,")
)

d[2]["text"] = (
    "Na última manhã a rua ensaia o desfile e o barulho começa cedo. "
    "Passeia gente de saia comprida. Passa um vestido verde e uma gravata larga.\n\n"
    "Um homem de boné dança sozinho na esquina. "
    "Renata leva o suéter até a lavanderia de Neuza. "
    "“Fica com ele”, ri Neuza. “Aqui ninguém devolve nada.”\n\n"
    "“A senhora escreveu tudo?” “Quase tudo”, responde Renata. "
    "“O resto eu já sei de cabeça, que é melhor.” "
    "“Eu volto e visito a senhora”, promete ela.\n\n"
    "“Então volta em junho”, diz Neuza. “Em junho é pior: chove todo dia. Mas volta.” "
    "Elas brincam com isso um tempo. Do lado de fora alguém canta desafinado.\n\n"
    "Uma mulher de sapato colorido pula a poça. "
    "Renata ri e filma dez segundos da rua. "
    "Escreve duas linhas na última página.\n\n"
    "Outra passa de tênis vermelhos, com um balão que quase voa. "
    "No primeiro dia ela apontava; agora pede, discute e agradece. "
    "Deseja voltar em junho, e ama esta rua como quem já esteve aqui."
)

json.dump(d, open(RUTA, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print("tema 7: bloques, Neuza nombrada antes de hablar, ancla de sonido")
