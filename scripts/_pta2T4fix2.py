"""La banda de habla citada del tema 4, medida sobre las doce historias.

La segunda iba en 22% y la tercera en 10%. En la tercera el problema era de
fondo: la escena mas bonita del journey estaba contada entera por el narrador
y Damiao apenas abria la boca, justo en la historia que existe para devolverle
la voz. Se reescribe con la conversacion dentro, y de paso el remate deja de
explicar lo que la escena ya dice.
"""
import json

RUTA = "scripts/_pta2T4.json"
d = json.load(open(RUTA, encoding="utf-8"))

d[1]["text"] = (
    d[1]["text"]
    .replace("A água passa escura pelo casco.", "A água passa rápida pelo casco.")
    .replace("“Segura firme.”", "“Segura firme, moça. Segura no banco, não no remo.”")
    .replace("“Puxa não, deixa solto.”", "“Puxa não, deixa solto. Se puxar, a gente vira.”")
    .replace("Renata sobe dez passos na areia irregular e para.", "Renata sobe dez passos na areia irregular.")
    .replace(
        "Damião salva o remo que ia embora. Voltam sem falar. “Amanhã?”, pergunta ela na margem, e ele não responde.",
        "Damião salva o remo que ia embora. Voltam sem falar. “Amanhã?”, pergunta ela na margem. Ele olha o céu e não responde.",
    )
)

d[2]["text"] = (
    "Às quatro ainda há estrela no céu e a lua está baixa. "
    "Renata caminha sozinha até a porta. Damião já espera, com a canoa pronta.\n\n"
    "“Hoje sai”, avisa ele. “Combinei com o rio.” "
    "Ela ri pela primeira vez em três dias.\n\n"
    "A areia está seca e firme. "
    "Entre as dunas aparece uma planta pequena e uma flor branca que ninguém plantou.\n\n"
    "“Isso aqui seca em maio”, conta Damião. “Em maio não tem nada. Só areia e vento.” "
    "“E você fica?” “Fico. Pesco no rio.”\n\n"
    "A lagoa é gigante e rasa. Renata nada dez metros e fica de pé, com água pela cintura. "
    "O sol brilha perto da margem.\n\n"
    "“Você não entra?”, ela pergunta, e cava a areia com o pé. "
    "“Eu entro todo dia”, responde ele. “A senhora entra hoje.”\n\n"
    "Ela salta uma vez sem motivo e volta a boiar. "
    "Não são férias e não é feriado: é uma quarta-feira qualquer.\n\n"
    "“Duas da tarde”, ela lembra. “Então aproveita”, diz ele. "
    "“Isso aqui fica igual, mas sem a senhora.”\n\n"
    "A água é bonita e ela está livre até as duas."
)
for v in d[2]["vocab"]:
    if v["word"] == "pescar":
        v["surface"] = "Pesco"
    if v["word"] == "secar":
        v["surface"] = "seca"

json.dump(d, open(RUTA, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print("tema 4: la conversacion dentro de la tercera, y la segunda en banda")
