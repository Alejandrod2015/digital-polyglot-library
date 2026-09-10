"""Los retoques de la revision de arco del chat de planificacion.

R1 · volto-pelo-caderno. La mitad de este ya estaba arreglada (la atribucion
   de la pregunta), pero la otra mitad era un fallo de logica de verdad: le
   dicen que su bus es el TERCEIRO de la fila y el caderno aparecia en el
   PRIMERO, al que entra por error. Ahora entra por error, sale, y el caderno
   esta donde tiene que estar.

R2 · quatro-meses-nao-dois. "o real nao era o dinheiro" en una escena de
   salario y de cobrar se lee como la moneda brasilena. Con "o assunto real"
   la palabra queda de adjetivo y no hay ambiguedad; la plaza se conserva.

R3 · quinze-folhas-e-barbante. Una caixinha no dice nada. Pasa a ser un aviso
   DENTRO de la caixinha, que es lo que es.

R4 · uma-lampada-so. "dorme bem viva de frio" es un acertijo y ademas se
   contradice: no se duerme bien y se esta bien viva a la vez. El remate pasa
   a imagen concreta, la franja de luz y la punta de la nariz.

R5 · a-caixa-que-nao-chegou. "A aula fica educada" no se entiende como
   predicado, y "chama ... ela chama" repetia en el mismo parrafo.
"""
import json

# R5 · tema 1
R1F = "scripts/_pta2T1.json"
d1 = json.load(open(R1F, encoding="utf-8"))
d1["stories"][0]["text"] = d1["stories"][0]["text"].replace(
    "Ela pega o lápis e chama cada um à frente, de três em três. “Escreve o seu”, ela chama. "
    "Ninguém parece à vontade, e Renata acha graça. A aula fica educada.",
    "Ela pega o lápis e chama cada um à frente, de três em três. “Escreve o seu”, pede. "
    "Ninguém parece à vontade, e Renata acha graça: escrevem devagar, educados, sem barulho.",
)
for v in d1["stories"][0]["vocab"]:
    if v["word"] == "educado":
        v["surface"] = "educados"
json.dump(d1, open(R1F, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

# R1 · tema 5
R5F = "scripts/_pta2T5.json"
d5 = json.load(open(R5F, encoding="utf-8"))
d5[2]["text"] = d5[2]["text"].replace(
    "Entra no primeiro por engano; o caderno está lá.",
    "Entra no primeiro por engano e sai. No terceiro, o caderno está na poltrona.",
)
json.dump(d5, open(R5F, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

# R2 y R3 · tema 6
R6F = "scripts/_pta2T6.json"
d6 = json.load(open(R6F, encoding="utf-8"))
d6[1]["text"] = d6[1]["text"].replace(
    "Pela primeira vez o real não era o dinheiro, era o calendário.",
    "Pela primeira vez o assunto real não era o dinheiro, era o calendário.",
)
d6[2]["text"] = d6[2]["text"].replace(
    "A caixinha do balcão diz que hoje não sai nada para fora do país.",
    "Um aviso na caixinha do balcão: hoje não sai nada para fora do país.",
)
json.dump(d6, open(R6F, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

# R4 · tema 7
R7F = "scripts/_pta2T7.json"
d7 = json.load(open(R7F, encoding="utf-8"))
d7[1]["text"] = d7[1]["text"].replace(
    "No escuro a janela amarela deixa passar uma faixa roxa, e ela dorme bem viva de frio.",
    "No escuro a janela amarela deixa passar uma faixa roxa. Ela olha a faixa até dormir, com o nariz vivo de frio.",
)
for v in d7[1]["vocab"]:
    if v["word"] == "vivo":
        v["surface"] = "vivo"
json.dump(d7, open(R7F, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

print("cinco retoques aplicados en cuatro temas")
