import json, re, sys, io
S = {
"arriba-vive-alguien": [
 ("Arriba vive alguien.", "Somebody lives upstairs."),
 ("Emilio pega una hoja en la puerta con dos trozos de cinta.", "Emilio sticks a sheet of paper on the door with two pieces of tape."),
 ("Son once normas y la primera es que la lavadora se apunta.", "There are eleven rules and the first is that you write the washing machine down."),
 ("Celia la lee entera,", "Celia reads it all the way through"),
 ("poco a poco.", "little by little"),
 ("El reciclaje lo mira el portal,", "The whole stairwell keeps an eye on the recycling"),
 ("no se escapa nadie", "nobody gets away with it"),
 ("avisa Emilio.", "Emilio warns"),
 ("Y para la antena hace falta permiso de todos,", "And for the aerial you need everyone's permission"),
 ("en serio", "seriously"),
 ("añade.", "he adds"),
 ("Ella cuelga tres perchas y estira una alfombra que no tapa el suelo.", "She hangs three hangers and spreads a rug that does not cover the floor."),
 ("La bombilla parpadea y un cable cuelga mojado del techo.", "The bulb flickers and a cable hangs wet from the ceiling."),
 ("Abre la ducha y el agua suena hueca dentro de la pared.", "She turns on the shower and the water sounds hollow inside the wall."),
 ("Emilio pasa el dedo por el polvo y calla.", "Emilio runs his finger through the dust and says nothing."),
 ("Si le falta una manta,", "If you are short of a blanket"),
 ("arriba hay dos en el altillo", "there are two up in the cupboard over the wardrobe"),
 ("ofrece.", "he offers"),
 ("Y el cepillo duro se lo presto,", "And I will lend you the stiff brush"),
 ("pero me lo devuelve sin falta", "but you bring it back without fail"),
 ("remata.", "he finishes"),
 ("Celia lo acepta y lo deja junto a la puerta.", "Celia takes it and leaves it by the door."),
 ("A las once alguien arrastra algo arriba,", "At eleven somebody drags something upstairs"),
 ("de golpe,", "all at once"),
 ("No es ruido de obra:", "It is not the noise of building work"),
 ("es alguien que vive ahí desde antes que ella.", "it is somebody who has lived there longer than she has."),
 ("De momento apunta la hora y la herramienta que Emilio promete.", "For now she notes the time, and the tool Emilio promises."),
],
"la-mayoria-decide-el-techo": [
 ("La mayoría decide el techo.", "The majority decides about the roof."),
 ("El anuncio de la reunión lleva tres días en el portal,", "The notice of the meeting has been in the entrance hall for three days"),
 ("y huele a cola.", "and it smells of glue"),
 ("Berta es la presidenta de la comunidad,", "Berta is the chairwoman of the residents"),
 ("y baja la primera.", "and she comes down first"),
 ("Celia baja con el portátil y una copia.", "Celia comes down with her laptop and a copy."),
 ("El orden del día es corto:", "The agenda is short"),
 ("el techo y poco más", "the roof and little else"),
 ("abre Berta.", "Berta opens"),
 ("Y sale o no sale por mayoría,", "And it passes or it does not, by majority"),
 ("no por quien grite", "not by whoever shouts"),
 ("añade.", "she adds"),
 ("Luego lo revisa todo en voz alta,", "Then she goes over it all out loud"),
 ("sin prisa.", "without hurrying"),
 ("Celia ofrece pagar su parte y la frase le sale corta.", "Celia offers to pay her share and the sentence comes out short."),
 ("Nadie contesta.", "Nobody answers."),
 ("Emilio levanta la mano y pide que conste su voto.", "Emilio raises his hand and asks for his vote to be recorded."),
 ("Tapar el agua con plástico es inútil,", "Covering the water with plastic is useless"),
 ("ya lo probamos", "we tried that already"),
 ("corta Berta.", "Berta cuts in"),
 ("Hay que firmar los tres y de una vez,", "The three of us have to sign, once and for all"),
 ("que la obra empieza en abril", "because the work starts in April"),
 ("remata.", "she finishes"),
 ("Ella apunta la fecha y busca dónde va la firma.", "She notes the date and looks for where the signature goes."),
 ("Al final llega el sello,", "In the end the stamp arrives"),
 ("y Berta resume el acta para cada uno.", "and Berta sums up the minutes for each of them."),
 ("La obra ya no depende de ella ni de Emilio por su cuenta.", "The work no longer depends on her, or on Emilio on his own."),
 ("Celia sube los cuatro pisos más tranquila.", "Celia goes up the four floors easier in her mind."),
]}
EX = {"celia","una","el","la","un","emilio","los","cuatro","dos","tres","uno","las","once","berta"}
slug = sys.argv[1]
out = {}
for es, en in S[slug]:
    for w in re.findall(r'[^\W\d_]+', es.lower(), re.UNICODE):
        if w in EX: continue
        out.setdefault(w, {"es": es.strip(" ,.;:"), "en": en})
io.open(f"scripts/_b1/g/{slug}.chunks.json", "w", encoding="utf-8").write(json.dumps(out, ensure_ascii=False, indent=1))
print(slug, len(out), "palabras con trozo")
