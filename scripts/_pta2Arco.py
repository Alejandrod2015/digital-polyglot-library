"""Tres defectos que ningun check ve, porque solo existen leyendo las 21 seguidas.

1. En "A panela que grudou" Edilson hace la pregunta y la contesta el mismo:
   "A regra vale ou nao vale?" ... "Vale", responde ele. Leido de corrido
   parece un fallo de atribucion. Con "admite" queda lo que la escena quiere,
   que es que CEDE.

2. Las historias 3 y 4, seguidas en el orden de lectura, cerraban las dos con
   Renata escribiendo en el caderno. El caderno es la espina del journey y
   tiene que volver, pero no siempre en el mismo sitio de la historia: en la 4
   pasa al medio y el remate es el frasco en el bolsillo.

3. En "Volto pelo caderno" Renata pregunta dos veces seguidas casi lo mismo
   ("Ja limparam aquele?" y "Aquele de Campo Grande, das seis?"). Se juntan en
   una.
"""
import json

# 1. La panela
RUTA3 = "scripts/_pta2T3.json"
d3 = json.load(open(RUTA3, encoding="utf-8"))
d3[2]["text"] = d3[2]["text"].replace(
    "“Vale”, responde ele, e solta a mochila no chão.",
    "“Vale”, admite ele, e solta a mochila no chão.",
)
json.dump(d3, open(RUTA3, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

# 2. El frasco
RUTA2 = "scripts/_pta2T2.json"
d2 = json.load(open(RUTA2, encoding="utf-8"))
d2[0]["text"] = d2[0]["text"].replace(
    "Se ficar pior, volta. No caderno escreve o nome do remédio e, embaixo, “avisar se não passar”.",
    "Se ficar pior, volta. Escreve “avisar se não passar” na última linha do caderno e guarda o frasco no bolso.",
)
json.dump(d2, open(RUTA2, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

# 3. Volto pelo caderno
RUTA5 = "scripts/_pta2T5.json"
d5 = json.load(open(RUTA5, encoding="utf-8"))
d5[2]["text"] = d5[2]["text"].replace(
    "“Já limparam aquele?”, pergunta ela.\n\n“Aquele de Campo Grande, das seis?”, pergunta Renata.",
    "\n\n“Aquele de Campo Grande, das seis, já limparam?”, pergunta Renata.",
)
json.dump(d5, open(RUTA5, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

print("tres arreglos de arco aplicados")
