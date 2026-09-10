"""El tic del tema: "diz" cerraba 6 de las 14 citas (43%, tope 40%).

No se ve leyendo una historia; se ve leyendo las tres seguidas, que es donde
lo mide cierraTema. Se cambian dos: una pasa a otro verbo y la otra pierde la
acotacion entera, que en una frase dicha para nadie sobraba.
"""
import json

RUTA = "scripts/_pta2T3.json"
d = json.load(open(RUTA, encoding="utf-8"))

d[1]["text"] = d[1]["text"].replace(
    "“Salgado demais”, diz baixinho, para ninguém.",
    "“Salgado demais.” Ela fala baixinho, para ninguém.",
)

d[2]["text"] = d[2]["text"].replace(
    "“Serve”, diz ela, e escorre o macarrão de ontem.",
    "“Serve”, responde ela, e escorre o macarrão de ontem.",
)

json.dump(d, open(RUTA, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print("tema 3: acotacion dominante repartida")
