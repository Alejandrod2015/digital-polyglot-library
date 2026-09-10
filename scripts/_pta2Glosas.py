"""Las glosas del A2 PT que no existen en ningun bundle hermano.

Se escriben EN CONTEXTO: la glosa sale de la frase donde la palabra cae en la
historia, no del diccionario. Las formas conjugadas se glosan como estan en el
texto ("tento" es "I try", no "tentar"), que es lo que el lector toca.
"""
import json

RUTA = "scripts/_newGlosses.json"
BUNDLE = "portuguese-traveler-brazil-a2"

NUEVAS = {
    # Tema 1, historia 1: la clase sin material
    "lousa": {"g": "blackboard on the classroom wall", "t": "noun"},
    "cadeiras": {"g": "chairs", "t": "noun"},
    "livro": {"g": "book", "t": "noun"},
    "dar": {"g": "to give; dar aula is to teach a class", "t": "verb"},
    "assim": {"g": "like this, this way", "t": "adverb"},
    "tento": {"g": "I try", "t": "verb"},
    "escrevo": {"g": "I write", "t": "verb"},
    "claro": {"g": "clear, easy to follow", "t": "adjective"},
    "tira": {"g": "takes out, pulls out", "t": "verb"},
    "giz": {"g": "chalk for writing on a blackboard", "t": "noun"},
    "enorme": {"g": "huge", "t": "adjective"},
    "turma": {"g": "class, the group of students", "t": "noun"},
    "enxerga": {"g": "can see, can make out from far away", "t": "verb"},
    "varro": {"g": "I sweep", "t": "verb"},
    "lápis": {"g": "pencil", "t": "noun"},
    "vontade": {"g": "ease; a vontade means comfortable", "t": "noun"},
    "graça": {"g": "achar graca means to find something funny", "t": "noun"},
    "educada": {"g": "polite, well mannered", "t": "adjective"},
    "quadro": {"g": "board at the front of the room", "t": "noun"},
    "mesmas": {"g": "same", "t": "adjective"},
    "entendem": {"g": "they understand", "t": "verb"},
    "apaga": {"g": "wipes clean, rubs out", "t": "verb"},
    # Tema 1, historia 2: el libro de contos
    "livraria": {"g": "bookshop", "t": "noun"},
    "guardado": {"g": "stored away for a long time", "t": "adjective"},
    "exemplar": {"g": "copy of a book", "t": "noun"},
    "contos": {"g": "short stories", "t": "noun"},
    "conto": {"g": "short story", "t": "noun"},
    "leio": {"g": "I read", "t": "verb"},
    "pra": {"g": "colloquial form of para, for or to", "t": "preposition"},
    "mim": {"g": "me, after a preposition", "t": "pronoun"},
    "teimosos": {"g": "stubborn", "t": "adjective"},
    "erro": {"g": "I get it wrong", "t": "verb"},
    "ideia": {"g": "idea", "t": "noun"},
    "esperto": {"g": "sharp, quick to work things out", "t": "adjective"},
    "convence": {"g": "convinces, wins someone over", "t": "verb"},
    "régua": {"g": "ruler for drawing straight lines", "t": "noun"},
    "borracha": {"g": "eraser", "t": "noun"},
    "lembra": {"g": "remembers", "t": "verb"},
    "aluna": {"g": "female student", "t": "noun"},
    "estudante": {"g": "student", "t": "noun"},
    "professor": {"g": "teacher", "t": "noun"},
    "salas": {"g": "rooms, here classrooms", "t": "noun"},
    # Tema 1, historia 3: el examen
    "entrar": {"g": "to get in, to be admitted", "t": "verb"},
    "faculdade": {"g": "university department you apply to", "t": "noun"},
    "exame": {"g": "entrance exam", "t": "noun"},
    "sexta": {"g": "Friday", "t": "noun"},
    "contou": {"g": "told, said it to anyone", "t": "verb"},
    "descobre": {"g": "finds out", "t": "verb"},
    "acaso": {"g": "por acaso means by chance", "t": "noun"},
    "biblioteca": {"g": "library", "t": "noun"},
    "estuda": {"g": "studies", "t": "verb"},
    "universidade": {"g": "university", "t": "noun"},
    "ensinar": {"g": "to teach", "t": "verb"},
    "idioma": {"g": "language", "t": "noun"},
    "ensaiam": {"g": "they rehearse, they practise it out loud", "t": "verb"},
    "oral": {"g": "spoken rather than written", "t": "adjective"},
    "perguntas": {"g": "questions", "t": "noun"},
    "ouço": {"g": "I am listening", "t": "verb"},
    "falo": {"g": "I speak", "t": "verb"},
    "vou": {"g": "I am going to", "t": "verb"},
    "conseguir": {"g": "to manage it, to pull it off", "t": "verb"},
    "aprendeu": {"g": "learned", "t": "verb"},
    "aprender": {"g": "to learn", "t": "verb"},
    "esta": {"g": "this one, feminine", "t": "pronoun"},
    "único": {"g": "the only one", "t": "adjective"},
    "aluno": {"g": "male student", "t": "noun"},
    "cumprimenta": {"g": "greets, says hello", "t": "verb"},
    "bastante": {"g": "enough, as much as it takes", "t": "adverb"},
}

d = json.load(open(RUTA, encoding="utf-8"))
d.setdefault(BUNDLE, {})
d[BUNDLE].update(NUEVAS)
json.dump(d, open(RUTA, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print(f"{BUNDLE}: {len(NUEVAS)} glosas escritas a mano; {len(d[BUNDLE])} en total")
