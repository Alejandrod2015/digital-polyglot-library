"""La presentacion de Renata en la primera historia del tema.

journey-character-introduction mide DENTRO del conjunto que se le pasa, y al
cerrar un tema ese conjunto son sus tres historias: alli la primera aparicion
de Renata es esta, y llegaba sin sintagma que dijera que es. Es la misma
convencion que sigue el B1 hermano, donde la primera de cada tema presenta a
la protagonista y las otras dos ya solo la nombran.

Se usa la TERCERA forma aprobada (nombre y oficio) porque el tema 1 gasto la
aposicion en Renata y el "quem" en Gilson; asi las tres alternan, que es lo
que pide journey-introduction-form-variety. Y la presentacion NO abre la
historia: la apertura sigue siendo el lugar, para no volver a poner tres de
seis aperturas con nombre desnudo.
"""
import json

RUTA = "scripts/_pta2T2.json"
d = json.load(open(RUTA, encoding="utf-8"))

d[0]["text"] = d[0]["text"].replace(
    "Em Recife o pescoço de Renata trava de vez; ontem dormiu mal e hoje não vira a cabeça. "
    "Quem atende na farmácia da esquina é Nilza, uma mulher que trabalha ali desde que a loja abriu. "
    "O balcão é alto e a fila é curta.",
    "Em Recife o pescoço trava de vez. Renata trabalha em escolas de idioma e está há um mês na "
    "estrada; ontem dormiu mal e hoje não vira a cabeça. "
    "Quem atende na farmácia da esquina é Nilza, uma mulher que está ali desde que a loja abriu.",
)

json.dump(d, open(RUTA, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print("tema 2: Renata presentada por oficio en la primera del tema")
