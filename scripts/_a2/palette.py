# -*- coding: utf-8 -*-
"""Paleta: la pool libre menos gramatica, numerales, meses, flexiones y
palabras que solo se usan en America. Lo que queda es lo que puede ocupar una
plaza de vocab del A2. Se lee a ojo, agrupada por letra."""
import re, sys, unicodedata
def deb(w): return "".join(c for c in unicodedata.normalize("NFD", w) if not unicodedata.combining(c))
libre = [l.strip() for l in open("scripts/_a2/pool-libre.txt", encoding="utf8") if l.strip()]
GRAM = set("""el la los las un una unos unas lo le les me te se nos os mi mis tu tus su sus
nuestro nuestra nuestros nuestras vuestro vuestra vuestros vuestras suya suyo suyas suyos tuya tuyo mia mio
yo tu el ella ellos ellas nosotros nosotras vosotros vosotras usted ustedes quien quienes quien cual cuales cuyo
que como cuando donde adonde cuanto cuanta cuantos cuantas por para con sin sobre bajo entre hacia hasta desde
segun ante tras contra durante mediante salvo y o u ni pero sino aunque porque pues si no se ya tan tanto tanta
tantos tantas muy mas menos casi tambien tampoco siempre nunca jamas aqui ahi alli aca alla asi entonces
luego despues antes ahora hoy ayer manana anoche todavia aun solo solo bien mal algo alguien alguno alguna
algunos algunas nada nadie ningun ninguna ninguno otro otra otros otras mismo misma cada todo toda todos todas
mucho mucha muchos muchas poco poca pocos pocas bastante demasiado varios varias cual cuales quizas
haber ser estar tener hacer poder decir ir ver dar saber querer llegar pasar deber poner parecer quedar creer
hablar llevar dejar seguir encontrar llamar venir pensar salir volver tomar conocer vivir sentir tratar mirar
contar empezar esperar buscar existir entrar trabajar escribir perder producir ocurrir entender pedir recibir
recordar terminar permitir aparecer conseguir comenzar servir sacar necesitar mantener resultar leer caer
cambiar presentar crear abrir considerar oir acabar convertir ganar formar traer partir morir aceptar realizar
suponer comprender lograr explicar preguntar tocar reconocer estudiar alcanzar nacer dirigir correr utilizar
pagar ayudar gustar""".split())
MESES = set("enero febrero marzo abril mayo junio julio agosto septiembre octubre noviembre diciembre".split())
DIAS = set("lunes martes miercoles jueves viernes sabado domingo".split())
NUM = set("""cero uno dos tres cuatro cinco seis siete ocho nueve diez once doce trece catorce quince dieciseis
diecisiete dieciocho diecinueve veinte treinta cuarenta cincuenta sesenta setenta ochenta noventa cien ciento
cientos mil millon billon decena centena docena primer primero primera segunda segundo tercera tercero cuarta
cuarto quinta quinto sexta sexto septima octava novena decima triple doble trio cuarteto""".split())
# Marcadores de America: si la palabra es de alla, en Espana no se dice.
LATAM = set("""alberca ajonjoli arepa banana banqueta? boleto bus camioneta canasta carnitas ceviche chancla
chanclas chile chipa choclo cholo colectivo combi departamento durazno elevador frazada gaseosa guajolote
horchata humita humitas jalar jamaica jitomate licuado licuadora lucuma mate medialuna medialunas mija mijo
mole morral nena nene omelet papa pileta playera plumon refrigerador regadera sandia? tamal tamales trajinera
vereda cuadra cuadras crayola crayon closet closet cobertor cubrecama credencial cedula chequera micro
zapatilla? bocina parlante celular computadora carro llanta neumatico taquilla tina camaron""".split())
out=[]
seen=set()
for w in libre:
    if " " in w: continue
    d=deb(w.lower())
    if len(d)<3: continue
    if d in GRAM or d in MESES or d in DIAS or d in NUM or d in LATAM: continue
    if not re.fullmatch(r"[a-zñ]+", d): continue
    # flexiones: femenino/plural de otra entrada ya vista
    base=None
    for cand in (d[:-1], d[:-2], d[:-1]+"o", d[:-2]+"o", d[:-2]+"e"):
        if cand in seen and len(cand)>=3: base=cand; break
    if base: continue
    seen.add(d); out.append(w)
print(f"{len(out)} palabras usables\n")
por={}
for w in out: por.setdefault(deb(w[0]).lower(), []).append(w)
for k in sorted(por): print(f"[{k}] " + " ".join(por[k]))
