"""El bloque de la ultima historia, y una trampa que conviene dejar escrita.

La superficie "ri" (de rir) hacia que el contador de plazas por bloque la
encontrara DENTRO de "primeiro", "colorido" y "brincam": el check compara por
subcadena, sin frontera de palabra, asi que una superficie de dos letras
aparece en casi todos los bloques y los infla. Se cambia la forma del texto a
"rindo", que no se esconde dentro de nada.

Y el tercer bloque, tres frases de dialogo seguidas, no tenia ninguna plaza.
Se le da una con una linea de narracion que ademas devuelve la calle a la
escena.
"""
import json

RUTA = "scripts/_pta2T7.json"
d = json.load(open(RUTA, encoding="utf-8"))

d[2]["text"] = (
    d[2]["text"]
    .replace(
        "“Fica com ele”, ri Neuza. “Aqui ninguém devolve nada.”",
        "“Fica com ele”, diz Neuza, rindo. “Aqui ninguém devolve nada, minha filha.”",
    )
    .replace(
        "“A senhora escreveu tudo?”",
        "Renata olha a saia comprida que passa lá fora. “A senhora escreveu tudo?”",
    )
    .replace("Renata ri e filma dez segundos da rua.", "Renata sorri e filma dez segundos da rua.")
    .replace("Outra passa de tênis vermelhos, com um balão que quase voa.", "Outra passa de tênis vermelhos com um balão que voa.")
    .replace("No primeiro dia ela apontava; agora pede, discute e agradece.", "No primeiro dia ela apontava; agora pede e agradece.")
)
for v in d[2]["vocab"]:
    if v["word"] == "rir":
        v["surface"] = "rindo"

json.dump(d, open(RUTA, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print("tema 7: superficie de rir sin subcadenas, y el bloque de dialogo con plaza")
