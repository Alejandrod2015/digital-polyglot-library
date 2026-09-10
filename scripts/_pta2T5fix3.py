"""La banda de habla citada de la tercera del tema 5: 17% contra un suelo de 25.

Mismo diagnostico que en Lencois y misma cura: no falta relleno, sobra
narrador. La escena de la garagem son dos personas resolviendo algo hablando
y estaba contada desde fuera. Se CONVIERTE narracion en dialogo (no se anade),
y de paso el precio deja de explicarse y se discute.
"""
import json

RUTA = "scripts/_pta2T5.json"
d = json.load(open(RUTA, encoding="utf-8"))

d[2]["text"] = (
    d[2]["text"]
    .replace(
        "Renata desce às seis e o ônibus segue sem ela. O caderno ficou na poltrona.",
        "Renata desce às seis. O caderno ficou na poltrona do ônibus.",
    )
    .replace(
        "Ele freia na porta em sete minutos. O preço foi curto.",
        "Ele freia na porta em sete minutos. “Foi barato”, diz ela. “Foi curto”, responde ele.",
    )
    .replace(
        "Dois homens descarregam malas e carregam outras.",
        "Dois homens descarregam malas e carregam outras. “Já limparam aquele?”, pergunta ela.",
    )
    .replace(
        "Faz dois meses, no primeiro dia, um rapaz escreveu ali a primeira palavra.",
        "Faz dois meses um rapaz escreveu ali a primeira palavra.",
    )
    .replace(
        "“Hoje vale”, diz ela.",
        "“Hoje vale”, diz ela. “Estava tudo aqui dentro.”",
    )
)

json.dump(d, open(RUTA, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print("tema 5: la garagem se resuelve hablando, no narrada")
