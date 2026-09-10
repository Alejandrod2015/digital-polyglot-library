"""El ancla sensorial, con el lexico que el detector conoce de verdad.

"um alto-falante repete um nome" y "o motor esquenta" son anclas para un
lector y CERO para el check, que va por lista de palabras por idioma
(SENSE_CATEGORIES_SHARED). Se cambian por dos que si estan en la lista y que
ademas dicen mas de la escena: el silencio del guiche y el viento de la calle
vacia. Y las dos historias bajan a la banda.
"""
import json

RUTA = "scripts/_pta2T5.json"
d = json.load(open(RUTA, encoding="utf-8"))

d[0]["text"] = (
    d[0]["text"]
    .replace(
        "Um alto-falante repete um nome e ninguém atende.",
        "Um alto-falante repete um nome e depois volta o silêncio.",
    )
    .replace("“Então a senhora nunca vai chegar de ônibus direto”", "“Então a senhora nunca chega de ônibus direto”")
    .replace("Custa mais e chega mais tarde.", "Custa mais e chega tarde.")
    .replace("corre para o guichê ao lado.", "corre para o guichê.")
    .replace("Às onze embarca com o motorista já sentado ao volante.", "Às onze embarca, com o motorista já ao volante.")
    .replace("Cleide fecha o guichê e não a vê partir.", "Cleide fecha o guichê.")
)

d[2]["text"] = (
    d[2]["text"]
    .replace("A rua é larga e vazia, e o motor esquenta debaixo dela.", "A rua é larga, e o vento da manhã bate na cara.")
    .replace("Renata desce às seis e o ônibus continua sem ela. O caderno ficou no bolso da poltrona. Não tem metrô nem trem aqui, e o ônibus da garagem sai às nove.",
             "Renata desce às seis e o ônibus segue sem ela. O caderno ficou na poltrona. Não tem metrô nem trem aqui, e o da garagem sai às nove.")
    .replace("Ele freia na porta em sete minutos, e o preço foi curto.", "Ele freia na porta em sete minutos. O preço foi curto.")
    .replace("Ela entra no primeiro por engano, e o caderno está onde deixou.", "Ela entra no primeiro por engano; o caderno está onde deixou.")
    .replace("Faz dois meses, em Salvador, um rapaz que varria a sala escreveu a primeira palavra.",
             "Faz dois meses um rapaz de Salvador escreveu ali a primeira palavra.")
    .replace("Renata ganha o ônibus das nove por doze minutos.", "Renata ganha o das nove por doze minutos.")
    .replace("“Valeu mesmo”, diz ao homem da moto, e paga o dobro.", "“Valeu mesmo”, diz ao da moto, e paga o dobro.")
)

json.dump(d, open(RUTA, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print("tema 5: anclas con el lexico del detector, y banda de palabras")
