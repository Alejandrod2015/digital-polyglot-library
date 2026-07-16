# -*- coding: utf-8 -*-
# Tema 1 (el-cotorreo, CDMX chilango) — REAUTORADO 2026-07-09 sobre las historias
# NARRADOR. El spec anterior era de la version multivoz: 48/54 ejercicios probaban
# palabras que ya no existen en el texto. Reglas: docs/practice-exercises-redesign.md
# + scripts/_EXERCISE_SPEC.md. Headline en forma de diccionario; la flexion vive
# dentro de [[ ]] o en la respuesta del cloze. Cloze = frase FRESCA, resoluble por
# significado y nunca por recordar la trama.
SPECS = [
{
 "slug":"le-toca-a-mateo",
 "X":[["lana","money, cash"],["chela","a beer"],
      ["güey","dude, guy"],["codo","stingy, tight with money"]],
 "M":[
  ["hueva","A todos les daba [[hueva]] soltar la lana.","the reluctance to do something","a sudden hurry","a bad temper","a good excuse"],
  ["vivales","El muy [[vivales]] llevaba días anunciando que andaba corto.","a slick operator","a hard worker","a quiet type","a rich cousin"],
  ["no mames","[[No mames]], ni que fueras a quebrar.","no way, come on","of course, sure","too bad, sorry","well done, nice"],
  ["chotear","Siguió [[choteándolo]] y Pablo levantó la vista para sumarse.","to mock, to tease","to defend someone","to pay for someone","to ignore someone"],
  ["echar choro","Mateo se puso a [[echar choro]] sobre que ya había pagado.","to spin a long line","to pay up fast","to keep quiet","to tell the truth"],
  ["mamada","Pura [[mamada]], y nadie le creyó una palabra.","nonsense, bullshit","a fair point","a good joke","an old story"],
  ["sacar la sopa","Le [[sacó la sopa]] sin levantar la voz.","to get the truth out","to serve him dinner","to end the argument","to lend him money"],
  ["cabrón","Eres un [[cabrón]], se rió Renata.","a cheeky rascal","a coward","a stranger","a genius"],
  ["carrilla","La mesa se le vino encima con pura [[carrilla]].","relentless teasing","loud music","real anger","quiet pity"],
  ["pinche","Al [[pinche]] Mateo no le quedó de otra.","damn, bloody","poor, unlucky","tall, large","kind, sweet"],
  ["hacerse pato","El que se [[hacía pato]] terminaba pagando.","to play dumb","to arrive early","to speak up","to pay first"],
  ["andar corto","Llevaba días diciendo que [[andaba corto]] de dinero.","short on cash","full of energy","running late","feeling sick"],
  ["no quedar de otra","Al final [[no le quedó de otra]] que pagar.","he had no choice","he refused flatly","he left early","he won easily"],
  ["de sobra","El sábado traía dinero [[de sobra]] en la cartera.","more than enough","barely any left","none at all","exactly the right"]
 ],
 "F":[
  ["cachó","Su mamá lo _____ comiendo pastel antes de la cena.","His mum _____ him eating cake before dinner.",
   "perdió","llamó","esperó","caught out","lost","called","waited for"],
  ["vaquita","Entre todos hicieron una _____ para el regalo de Ana.","Between them they had a _____ for Ana's present.",
   "fila","broma","lista","whip round","queue","joke","list"],
  ["tranzado","El mecánico nos había _____ con el precio del motor.","The mechanic had _____ us on the engine price.",
   "ayudado","llamado","esperado","swindled","helped","called","waited for"],
  ["zafarse","Buscaba una excusa para _____ de la reunión del lunes.","He was looking for an excuse to _____ Monday's meeting.",
   "quejarse","reírse","acordarse","wriggle out of","complain about","laugh about","remember"],
  ["cotorreando","Se quedaron _____ en la cocina hasta las tres.","They stayed _____ in the kitchen until three.",
   "discutiendo","cocinando","limpiando","chatting and joking","arguing","cooking","cleaning"],
  ["aflojar","Al final tuvo que _____ el dinero de la multa.","In the end he had to _____ the fine money.",
   "pedir","contar","guardar","cough up","ask for","count","keep"]
 ]
},
{
 "slug":"ahorita-salgo",
 "X":[["banda","your group of friends"],["morra","a girl, a young woman"],
      ["reventón","a big late party"],["chido","cool, great"]],
 "M":[
  ["ahorita","Cuando decía \"[[ahorita]] salgo\", había que sumarle una hora.","in a minute, but never","right this second","tomorrow morning","late last night"],
  ["echar raíces","Los demás llevaban rato [[echando raíces]] en la esquina.","to wait around forever","to plant a garden","to leave quickly","to head home"],
  ["neta","[[Neta]], era la reina de llegar tarde.","seriously, for real","maybe, perhaps","never, not once","almost, nearly"],
  ["qué pedo","¿[[Qué pedo]], ya te acordaste de nosotros?","what's up","how much","where to","who else"],
  ["gacho","Los demás se sumaron igual de [[gachos]].","nasty, mean","kind, warm","tired, sleepy","rich, posh"],
  ["culero","Pablo estuvo especialmente [[culero]], contando la vez que los dejó afuera.","nasty, a real jerk","generous, giving","shy, quiet","funny, witty"],
  ["sin despeinarse","Renata, [[sin despeinarse]], sacó su pretexto de siempre.","without breaking a sweat","after a long fight","with real regret","in a great hurry"],
  ["bronca","Esta vez no se defendió ni armó [[bronca]].","a fight, a fuss","a good excuse","a long speech","a quick exit"],
  ["movida","Traía una [[movida]] preparada desde el lunes.","a clever move","a heavy bag","a bad mood","a long trip"],
  ["chingón","Los apantalló con un movimiento bien [[chingón]].","awesome, badass","clumsy, awkward","boring, dull","cheap, tacky"],
  ["crudo","El viernes amanecieron [[crudos]], arrepentidos y felices.","hungover","well rested","still drunk","wide awake"],
  ["muerto de frío","Esperaban en la esquina, [[muertos de frío]].","freezing cold","soaking wet","half asleep","bored stiff"],
  ["llevar rato","Los demás [[llevaban rato]] esperando en la banqueta.","had been a while","had just arrived","were about to leave","had already left"]
 ],
 "F":[
  ["vacilar","A mi hermano le encanta _____ a sus amigos.","My brother loves to _____ his friends.",
   "ayudar","llamar","esperar","tease","help","call","wait for"],
  ["chambear","Le toca _____ hasta tarde todos los jueves.","She has to _____ late every Thursday.",
   "descansar","cocinar","estudiar","work","rest","cook","study"],
  ["plantado","Nos había _____ dos veces sin avisar.","She had _____ us twice without warning.",
   "llamado","ayudado","esperado","stood up","called","helped","waited for"],
  ["agandallando","Los demás la siguieron _____ un rato más.","The others kept _____ her a while longer.",
   "ayudando","llamando","esperando","ganging up on","helping","calling","waiting for"],
  ["apantalló","Con ese regalo los _____ a todos de una vez.","With that present he _____ everyone at once.",
   "aburrió","llamó","esperó","dazzled","bored","called","waited for"],
  ["rifarse","Ese cuate sabe _____ cuando alguien necesita ayuda.","That guy knows how to _____ when someone needs help.",
   "quejarse","reírse","dormirse","come through","complain","laugh","fall asleep"]
 ]
},
{
 "slug":"diez-intentos",
 "X":[["refri","the fridge"],["compa","buddy, mate"],
      ["cuate","a close friend"],["galán","a heartthrob"]],
 "M":[
  ["cursi","A Sofía se le ocurrió una idea medio [[cursi]].","cheesy, corny","very clever","quite risky","rather rude"],
  ["desmadre","Algo tan simple se iba a volver semejante [[desmadre]].","a total mess, chaos","a quiet evening","a small favour","a good deal"],
  ["mamón","Se puso hasta adelante, con una cara de [[mamón]].","stuck up, smug","scared, nervous","sad, gloomy","tired, bored"],
  ["el mero mero","Ahí estaba, parado como [[el mero mero]].","the big shot","the last one","the lost one","the new guy"],
  ["chafa","En realidad se veía bastante [[chafa]].","tacky, cheap","quite elegant","very funny","rather shy"],
  ["naco","Te ves bien [[naco]], le dijo Pablo.","tacky, low class","very smart","really strong","quite calm"],
  ["cagada","La [[cagada]] llegó cuando nadie sabía usar el temporizador.","the screw up","the best part","the last try","the good news"],
  ["qué oso","Nadie sabía usar el temporizador. [[Qué oso]].","how embarrassing","how lucky","how strange","how boring"],
  ["órale","[[Órale]], ahora sí, todos quietos.","come on, alright","not yet","never mind","too late"],
  ["de perdis","[[De perdis]], esa sí los agarró viendo a la cámara.","at least, if nothing else","by pure luck","for the last time","fully on purpose"],
  ["valer madres","A esas alturas ya les [[valía madres]].","to not care at all","to feel real regret","to want more tries","to get truly angry"],
  ["muerto de hambre","Renata apuraba desde atrás, [[muerta de hambre]].","starving","stuffed full","wide awake","fast asleep"],
  ["hasta adelante","Se plantó [[hasta adelante]] para salir en la foto.","right at the front","far in the back","off to one side","behind everyone else"]
 ],
 "F":[
  ["aventó","Se _____ un discurso larguísimo sin que nadie se lo pidiera.","He _____ a very long speech nobody asked for.",
   "perdió","aprendió","escribió","threw out","lost","learned","wrote"],
  ["clavando","Se estaban _____ demasiado con los detalles.","They were getting _____ too much on the details.",
   "quejando","riendo","durmiendo","obsessed","complaining","laughing","sleeping"],
  ["chutaron","Se _____ tres horas de discursos sin quejarse.","They _____ three hours of speeches without complaining.",
   "perdieron","contaron","olvidaron","sat through","missed","counted","forgot"],
  ["chueca","La foto quedó toda _____ y nadie quiso repetirla.","The photo came out all _____ and nobody wanted to redo it.",
   "limpia","nueva","cara","crooked","clean","new","expensive"],
  ["la riega","Siempre _____ cuando intenta contar un chiste.","He always _____ when he tries to tell a joke.",
   "la cuenta","la escribe","la olvida","messes it up","tells it","writes it","forgets it"],
  ["pendejadas","Se pasan la tarde diciendo puras _____ y riéndose.","They spend the afternoon saying pure _____ and laughing.",
   "verdades","noticias","preguntas","stupid stuff","truths","news","questions"]
 ]
}
]
