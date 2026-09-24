import sys, os
sys.path.insert(0, os.path.dirname(__file__))
import _molde as m
m.SLUG = "domingo-sin-senal"
M, F, MATCH = m.M, m.F, m.MATCH

ejercicios = [
 MATCH([("la clave", "a password"), ("el celular", "a mobile phone"), ("la erre", "the letter R"), ("la mayúscula", "a capital letter")]),
 M("prueba", "Mariana sube y [[prueba]] la clave. Su celular dice error.", "tries out", ["writes down", "forgets", "shares"]),
 F("regresa", "Ella _____ y toca la puerta.",
   ["prueba", "ayuda", "escribe"],
   "She _____ and knocks on the door.",
   ["comes back", "tries", "helps", "writes"]),
 F("anda", "El internet de su casa no _____.",
   ["prueba", "regresa", "escribe"],
   "The internet at her flat does not _____.",
   ["work", "try", "come back", "write"]),
 M("película", "Mariana quiere ver una [[película]].", "film", ["match", "series", "recipe"]),
 M("ayuda", "En el sofá la gata duerme tranquila. No [[ayuda]].", "she is no help", ["she is no trouble", "she is not hers", "she is not well"]),
 M("no entra", "Tu clave [[no entra]].", "does not work", ["does not fit", "does not matter", "does not exist"]),
 M("así", "Nadie escribe [[así]] un nombre.", "like that", ["down", "twice", "by hand"]),
 M("cambio", "Ya no la [[cambio]].", "I am changing it", ["I am saving it", "I am sharing it", "I am hiding it"]),
 M("aparatos", "Tengo diez [[aparatos]].", "devices", ["neighbours", "windows", "passwords"]),
 # pool
 M("domingo", "Es [[domingo]].", "Sunday", ["Monday", "Friday", "Tuesday"]),
 M("Claro", "[[Claro]].", "sure", ["hardly", "maybe", "wait"]),
 M("error", "Su celular dice [[error]].", "error", ["alarm", "loading", "ready"]),
 M("internet", "Mi [[internet]] no anda hoy.", "internet", ["intercom", "phone", "heating"]),
 M("en serio", "Pon dos erres. Es [[en serio]].", "I mean it", ["I am guessing", "I forgot", "I am joking"]),
 M("escribo", "Yo [[escribo]] la clave ahora.", "I will write down", ["I will guess", "I will change", "I will repeat"]),
 M("ahora", "Yo escribo la clave [[ahora]].", "right now", ["out loud", "by heart", "on paper"]),
]
m.escribe(m.SLUG, ejercicios)
