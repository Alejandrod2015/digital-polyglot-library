# -*- coding: utf-8 -*-
"""Reparto de las 420 plazas viejas entre los siete temas NUEVOS.

Estan validadas y sin solape, pero pegadas a las escenas de la version anterior.
Aqui se dice, palabra por palabra, a que escena nueva pasa y cual se cae. Las
que se caen hay que reponerlas con candidatos verificados (`_a1latamCand.ts`).
Las entradas multipalabra van enteras: la lista se separa por COMAS, no por
espacios, que fue el fallo de la primera version."""
import json, sys
D = json.load(open("scripts/_a1latamStories.json", encoding="utf-8"))
VIEJAS = sorted({v["word"] for s in D for v in s["vocab"]})

LLEVA = {
 "night-buses":
   "valija, libreta, taquilla, boleto, ruta, equipaje, andén, oscuridad, precio, letrero, "
   "curva, ventanilla, manta, frenar, despertar, cinturón, termo, pasillo, subida, bajada, "
   "farol, estacionamiento, galleta, tampoco, aunque, tan, apoyar, subrayar, prender, avión, "
   "triple, de repuesto, mientras, en punto, bastante, lentamente, descanso, botella, viajero, "
   "pasaje, llegada, cómodo, detrás, poner, disponible, falta gente, seguramente, prestar, "
   "la gente con plata, al fin",
 "prices-and-change":
   "cambio, cifra, oferta, cola, sencillo, monedero, revisar, descuento, comparar, tarjeta, "
   "elegir, caro, perder, ganar, marcar, de más, según, total, persona, docena, listo, gasto, "
   "mitad, cantidad, casi vacío, pesado, por eso, durante, comerse, azúcar, leche, manteca, "
   "tazón, untar, torta, frutilla, mermelada, ahorrar, sumar, restar, traer",
 "calls-and-messages":
   "señal, pantalla, cargador, teclado, contraseña, contacto, aplicación, red, conexión, "
   "auricular, tono, llamada, nota de voz, altavoz, fecha, botón, micrófono, marca, zumbido, "
   "prisa, demorar, exactamente, suavemente, pálido, temor, mentira, signo, suyo, agenda, "
   "correo, aviso, nunca, uno por uno, ya no, celular, jefa, lento, seguido, propio",
 "help-and-repairs":
   "roto, punta, sujetar, pegamento, cordel, cajón, repisa, clavo, romo, reparar, pinza, "
   "juntar, parte, recto, cinta adhesiva, firme, servir, extremo, varilla, viejo, usado, "
   "común, palma, canto, fino, callar, profundo, complicado, intentar, fácil, simple, tapa, "
   "polvo, pintura, tabla, martillo, tornillo, destornillador, herramienta, alambre, gesto, "
   "no te preocupes, suficiente",
 "names-for-things":
   "mesero, mantel, manga, lápiz, menú, correcto, incorrecto, colectivo, bondi, modo, "
   "diferente, cuchillo, tenedor, cuchara, frase, equivocarse, idioma, parecido, darse cuenta, "
   "necesario, nevera, birome, medialuna, pileta, pizarra, marcador, ancho, izquierda, juego, "
   "verdadero, está todo mal, butaca, quieto, columna, negar, clase, nota, limonada, avenida, "
   "plegar, hoja, fuera, frente, tinta, pasaporte, alrededor, folleto, trato hecho, jamás, "
   "cartelera, vitrina, mirá vos, campera, vidrio, sucio",
 "doors-and-neighbours":
   "cuarto, planta, frazada, sábana, colchón, duro, ropero, alquiler, cerradura, azulejo, "
   "mojado, cortina, bote, inquilino, barato, limpieza, almohada, por noche, linterna, "
   "bombilla, grifo, ducha, desagüe, jarra, cubeta, interruptor, enchufe, espuma, calentar, "
   "vapor, lavabo, escoba, gotear, quejarse, paño, electricidad, girar, billetera, faltar, "
   "deber, disculpe, lista, ofrecer, borde, cerrojo, contestar, taburete, sobrar, "
   "hazme el favor, incluso, vecino, reja, candado, tapia, patrón",
 "plans-and-invitations":
   "local, fondo, cuadra, morral, acera, bordillo, banca, sello, empleado, empresa, orden, "
   "regla, servicio, ida y vuelta, por ciento, tanto, plan, único, completo, sentado, "
   "escritorio, pausa, enojado, ansioso, malas noticias, labio, mejilla, pecho, brazo, pierna, "
   "cadena, metal, mirada, sostener, ligero, tinto, clima, amplio, oficina, cédula, planilla, "
   "casilla, aprobar, pedido, carpeta",
}

# Los 92 huecos, repuestos con candidatos verificados uno a uno contra el cubo
# duro de la pool y contra la lista A1/A2 (`_a1latamCand.ts`). Nada aqui esta
# puesto de memoria: los que chocaban o se salian de nivel se descartaron.
REPONE = {
 "night-buses":
   "terminal, parada, abrigo, horario, retraso, pueblo, asiento, bolso, trayecto, dormirse",
 "prices-and-change":
   "envolver, rebanada, jitomate, feria, cobrar, medio, pila, verdura, carnicería, bolsita, "
   "apurado, pedir, alcanzar, costar, justo, exacto, redondo, salado, cargar",
 "calls-and-messages":
   "saludo, sobrina, primo, noticia, número, borrar, foto, silencio, familia, apagado, "
   "encendido, mensaje, semana, madre, apellido, retrato, carta, sobre, guitarra, hermana, boda",
 "help-and-repairs":
   "barniz, pincel, figura, pata, arreglar, goma, trozo, apretar, secar, brillo, raya, mancha, "
   "doblar, romperse, hueco, torcido, liso",
 "names-for-things":
   "factura, zapatillas, lomito, cortado, churro",
 "doors-and-neighbours":
   "patio, terraza, portón, ventilador, abanico",
 "plans-and-invitations":
   "quedar, invitar, entrada, fila, escenario, ensayo, letra, globo, asado, picada, "
   "submarino, avisar, ruido, escalón, empanada",
}
REPONE = {t: [w.strip() for w in s.split(",") if w.strip()] for t, s in REPONE.items()}

LLEVA = {t: [w.strip() for w in s.split(",") if w.strip()] for t, s in LLEVA.items()}
usadas, dup = {}, []
for t, ws in LLEVA.items():
    for w in ws:
        if w in usadas: dup.append((w, usadas[w], t))
        usadas[w] = t
falt = [w for w in VIEJAS if w not in usadas]
inv  = [w for w in usadas if w not in VIEJAS]
print(f"plazas viejas distintas: {len(VIEJAS)}")
print(f"reubicadas: {len(usadas)} · se caen: {len(falt)}")
if inv: print("NO EXISTEN entre las viejas:", inv)
tot = 0
for t, ws in LLEVA.items():
    print(f"  {t:24s} {len(ws):>3} llevadas · faltan {60-len(ws):>2}")
    tot += 60 - len(ws)
print(f"  {'TOTAL a reponer':24s} {tot}")
if dup: print("\nDUPLICADAS:", dup)
if "-v" in sys.argv: print("\nse caen:\n  " + ", ".join(falt))

print()
malas = []
todo = {}
for t in LLEVA:
    plazas = LLEVA[t] + REPONE.get(t, [])
    for w in plazas:
        if w in todo: malas.append((w, todo[w], t))
        todo[w] = t
    print(f"  {t:24s} {len(LLEVA[t]):>3} llevadas + {len(REPONE.get(t,[])):>2} repuestas = {len(plazas):>3}")
print(f"  {'TOTAL':24s} {len(todo)} plazas")
if malas: print("REPETIDAS:", malas)
raices = {}
for w, t in todo.items():
    r = w[:5]
    raices.setdefault(r, []).append(w)
choq = {r: v for r, v in raices.items() if len(v) > 1}
if choq: print("\nMISMA RAIZ (revisar a mano):", {r: v for r, v in list(choq.items())})
