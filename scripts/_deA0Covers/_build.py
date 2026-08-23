# -*- coding: utf-8 -*-
"""Escribe los 21 ficheros de escena del DE A0 Traveler.

El candado de estilo lo antepone generateCover.ts; aqui va SOLO la escena,
pero la escena ya lleva las cuatro cosas de
feedback_cover_prompt_closed_before_first_render:
  1. ficha literal de cada recurrente (edad, pelo, color fijo de ropa)
  2. registro visual anclado
  3. reparto corto y COMPLETAMENTE descrito, sin huecos
  4. prohibicion de texto y ningun objeto escribible en la escena
"""
import os

BASE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(BASE, "scenes")

REGISTER = (
    "Flat saturated colour, thick clean linework, strong clear daylight, "
    "figures at mid distance as part of the place, generous air around them."
)

SKIN_FRAMING = (
    "Faces in three quarter view so both eyes read clearly, calm and absorbed "
    "in the moment, turned towards the scene and not towards the viewer."
)

NOTEXT = ""

FICHA = {
"hannah":
 ("Hannah, 32, straight dark brown hair to the shoulders, mustard yellow jacket, white t-shirt, blue jeans, small dark green backpack"),
"elias":
 ("Elias, 33, short black hair, clean shaven, dark teal zip jacket, grey t-shirt, black jeans"),
"sophie":
 ("Sophie, 30, long chestnut hair in a low ponytail, coral red cardigan, white blouse, dark trousers"),
"noah":
 ("Noah, 34, short light brown hair, clean shaven, forest green fleece work vest, beige shirt, brown work trousers"),
"emilia":
 ("Emilia, 34, very short modern crop dyed cool silver, smooth unlined young face, grey linen shirt with rolled sleeves, blue jeans"),
"leon":
 ("Leon, 35, short dark blond hair, clean shaven, broad shoulders, navy blue knitted sweater, dark work trousers"),
"marie":
 ("Katrin, 48, dark brown hair with no grey pinned in a loose bun, plum purple apron, cream blouse, long dark skirt"),
}

def cast_block(keys, extras=None):
    people = [FICHA[k] for k in keys] + list(extras or [])
    return "IN FRAME (%d people, all adults): " % len(people) + "; ".join(people) + "."

SCENES = []
def scene(slug, action, keys, extras=None):
    SCENES.append((slug, "\n\n".join(x for x in [action.strip(), cast_block(keys, extras), SKIN_FRAMING, REGISTER, NOTEXT] if x)))

# --- Topic 1: Dresden ---------------------------------------------------
scene("wieder-in-dresden",
 "Late afternoon on the wide stone square in front of the domed Frauenkirche in "
 "Dresden. A street musician stands playing a violin, his hat lying on the "
 "pale stone beside him, while Hannah and Elias walk slowly past him without "
 "speaking, an arm's length apart, both looking straight ahead. Warm low sun "
 "on the sandstone.",
 ["hannah", "elias"],
 ["the street musician, a man of 30, short curly black hair, clean shaven, rust "
  "orange shirt, playing a violin with his eyes on the strings"])

scene("die-brucke-uber-die-elbe",
 "Early morning on the long old stone bridge over the Elbe in Dresden, grey "
 "mist low on the water. Hannah stands at the middle of the bridge with one "
 "hand flat on the parapet and her backpack on the stone beside her; Elias "
 "stands close, a paper cup of coffee in one hand, the other arm stretched out "
 "towards the misted towers on the far bank. A long low riverboat passes "
 "beneath them. Cool silver light.",
 ["hannah", "elias"])

scene("die-treppe-an-der-elbe",
 "Warm summer evening on the broad old stone steps down to the Elbe in "
 "Dresden. A young man sits on the steps playing an acoustic guitar, and a "
 "little below him Hannah and Elias sit side by side a friendly distance "
 "apart, both looking out at the dark water where a small unlit boat glides "
 "past. Last orange light on the river.",
 ["hannah", "elias"],
 ["the guitar player, a man of 27, short brown hair, clean shaven, blue "
  "t-shirt and jeans, sitting on the steps with an acoustic guitar"])

# --- Topic 2: Heidelberg ------------------------------------------------
scene("sophie-kocht-am-neckar",
 "Midday inside a small, bright, warm flat in Heidelberg, the green river "
 "Neckar visible through the open window. Sophie stands at the stove lifting "
 "a pan of Spaetzle noodles in sauce; Hannah is laying the small wooden table "
 "with plates and a jug of apple juice; Elias sits at the table with his "
 "hands flat on the wood, waiting and hungry. Clean simple furniture, no "
 "clutter. Bright white daylight from the window.",
 ["hannah", "elias", "sophie"])

scene("das-schloss-uber-heidelberg",
 "Inside the cool stone cellar under the ruined red sandstone castle above "
 "Heidelberg. An enormous plain wooden barrel as big as a whole room fills "
 "the back of the cellar, its boards completely bare and unmarked. Sophie "
 "stands in front of it with one hand raised, explaining; Hannah looks up at "
 "the sheer size of it; Elias is whistling, his lips pursed, head tipped "
 "back. Thick pale stone walls, a shaft of daylight from a small high opening.",
 ["hannah", "elias", "sophie"])

scene("der-affe-an-der-alten-brucke",
 "Bright afternoon at the gate of the old arched bridge in Heidelberg, "
 "between two round pale towers. A polished bronze monkey sculpture sits on a "
 "low pedestal beside the gate. Hannah has laid her flat palm on the monkey's "
 "cold head and is laughing; Sophie stands close beside her with an arm "
 "around her shoulders; Elias is a few steps back holding up a small camera "
 "to photograph the two cousins. The green river and a single rowing boat "
 "behind them.",
 ["hannah", "elias", "sophie"])

# --- Topic 3: Schwarzwald ----------------------------------------------
scene("der-zug-nach-triberg",
 "Afternoon on the small open platform of the village station in Triberg in "
 "the Black Forest, dark fir slopes rising close behind. A red regional train "
 "stands at the platform with its doors open. Noah has just taken Hannah's "
 "rucksack from her and holds it in one hand, smiling; Hannah stands in front "
 "of him looking tired, her arms loose at her sides. His green vest is the "
 "brightest thing in the picture. Clean bare platform, no signs and no boards "
 "of any kind.",
 ["hannah", "noah"])

scene("nebel-uber-dem-pfad",
 "A high open meadow in the Black Forest, standing above a solid white sea of "
 "fog that hides everything below; only the black tips of fir trees break "
 "through it. Hannah sits in the grass with her legs stretched out and her "
 "swollen ankle bare, her face lifted and relieved; Noah stands beside her "
 "with one arm out, showing her the white world below. Hard clean sunlight "
 "above the fog, deep blue sky.",
 ["hannah", "noah"])

scene("die-kuckucksuhr-von-noahs-vater",
 "Inside a cramped, warm woodcarver's workshop in the Black Forest. Carved "
 "wooden cuckoo clocks hang and stand on a long shelf along the back wall; "
 "every single clock face is completely plain and blank, with no numbers, no "
 "hands and no markings at all. Wood offcuts and chisels lie everywhere. "
 "Hannah sits on a low stool with her bandaged ankle out to one side, "
 "watching; Noah sits opposite her cutting a small bird out of pale wood with "
 "a thin knife, shavings falling onto the table. Warm lamplight, sawdust in "
 "the air.",
 ["hannah", "noah"])

# --- Topic 4: Bodensee --------------------------------------------------
scene("die-fahre-nach-meersburg",
 "A bright breezy morning on the open top deck of the car ferry crossing the "
 "wide flat lake to Meersburg, white gulls wheeling over the rail. Hannah and "
 "Elias stand at the rail looking towards the shore, where the small harbour "
 "and steep lanes of colourful houses with bright shutters climb to an old "
 "castle. Emilia waits on the stone quay with both arms up in a big wave. "
 "Clean turquoise water, strong daylight.",
 ["hannah", "elias", "emilia"])

scene("kaltes-wasser-vor-der-insel-mainau",
 "Midday out on the open lake, the small wooded island of Mainau green in the "
 "background. A little open motorboat drifts with its engine stopped. Emilia "
 "and Hannah are in the deep cold water beside the boat, only their heads and "
 "shoulders above the surface, faces close and serious, Emilia's hand gripping "
 "the boat's rim; Hannah's bare shoulders are red with cold. Elias kneels on "
 "board holding a folded white towel ready, leaning towards them. Deep blue "
 "water, hard clean sunlight.",
 ["hannah", "elias", "emilia"])

scene("emilias-garten-in-meersburg",
 "Golden late afternoon on a steep terraced vineyard above the lake at "
 "Meersburg, long straight rows of vines running down the warm slope. Emilia "
 "is cutting old branches with secateurs; Hannah gathers the cut branches "
 "into a big wicker basket; Elias kneels at the path mending a low wooden "
 "fence. Behind them a small table is laid under an apple tree with bread, a "
 "whole fish and a jug of cider. The low sun lies flat over the water and "
 "everything glows gold.",
 ["hannah", "elias", "emilia"])

# --- Topic 5: Ruegen ----------------------------------------------------
scene("leons-kutter-im-hafen-von-sassnitz",
 "Late afternoon on the wooden jetty of the fishing harbour at Sassnitz on "
 "the Baltic coast. An old wooden fishing cutter with a completely plain "
 "unpainted hull, no numbers and no markings, lies against the jetty among "
 "other boats. Leon stands on the jetty with a thick wet rope in both hands, "
 "his mouth open and his whole body stopped in surprise at seeing Hannah; "
 "Hannah stands a few steps away with her hands in her jacket pockets. Two "
 "shallow crates of ice with two thin fish in them sit on the boards. Gulls "
 "over the water, cold bright coastal light.",
 ["hannah", "leon"])

scene("kreide-am-konigsstuhl",
 "A bright hard day on the narrow stony beach directly under the tall white "
 "chalk cliffs of Ruegen, beech trees growing right to the cliff edge far "
 "above with their roots hanging free in the air. Hannah crouches at the "
 "waterline holding up a small flint stone with a hole through it, examining "
 "it; Leon stands a little apart with his back half turned to her, one arm "
 "pointing up at the crumbling cliff edge, his face closed and angry. Wet "
 "rolling stones, white cliff, blue green sea, hard shadows.",
 ["hannah", "leon"])

scene("der-leuchtturm-von-kap-arkona",
 "Night on the narrow open gallery at the top of the lighthouse at Kap "
 "Arkona, the wind visibly tearing at everything. Hannah stands gripping the "
 "iron railing, swallowed by a yellow oilskin jacket several sizes too big, "
 "pulling it tighter around herself; Leon stands beside her looking out to "
 "sea, not at her. The wide beam of the lighthouse sweeps out over the black "
 "water and the tiny dark village far below. Deep blue night, one strong warm "
 "beam of light.",
 ["hannah", "leon"])

# --- Topic 6: Nuernberg -------------------------------------------------
scene("katrins-lebkuchen-am-hauptmarkt",
 "A busy Friday morning at a gingerbread stall on the big market square in "
 "Nuernberg, the ornate church front behind. The stall counter is stacked "
 "with round gingerbread biscuits and colourful old painted tin boxes "
 "decorated only with simple flower patterns and no writing at all; there are "
 "no price signs, no boards and no labels anywhere on the stall. Katrin leans "
 "over the counter holding out one piece of gingerbread to Hannah, who takes "
 "it; one customer waits to one side. Warm morning light, saturated reds and "
 "golds.",
 ["hannah", "marie"],
 ["a customer, a woman of 40 with shoulder length blonde hair in a blue coat, "
  "waiting patiently with a basket on her arm"])

scene("zinnfiguren-in-der-werkstatt-kleeblatt",
 "Inside a narrow, warm pewter caster's workshop. A craftsman tips a small "
 "ladle of glowing molten metal carefully into a heavy grey stone mould on "
 "the bench; a tiny finished knight figure the size of a thumb stands on the "
 "bench beside it. Katrin watches from close by with her hands folded, "
 "speaking quietly; Hannah stands next to her looking down at the little "
 "figure. Warm orange glow from the metal against cool grey stone.",
 ["hannah", "marie"],
 ["the craftsman, a man of 52 with short dark brown hair and no grey, clean "
  "shaven with no beard, a lean lined face that is clearly middle aged and "
  "not old, wearing a heavy brown leather apron over a blue shirt"])

scene("bratwurst-am-kettensteg",
 "Midday on the stone steps at the water's edge beside the old iron chain "
 "footbridge hanging over the narrow river in Nuernberg, thin grey smoke from "
 "a grill drifting through the lane behind. Katrin and Hannah sit side by side "
 "on the steps, each holding a bread roll with small grilled sausages in it; "
 "Katrin is chewing slowly and looking at the water with wet eyes; Hannah has "
 "turned towards her. Ducks sleep on the stones under the bridge. Bright "
 "midday light, warm greys and greens.",
 ["hannah", "marie"])

# --- Topic 7: Zugspitze -------------------------------------------------
scene("die-zahnradbahn-nach-grainau",
 "Inside the wooden carriage of an old cog railway climbing steeply through "
 "thick forest, the trees rushing past the big window. Hannah sits by the "
 "window facing Elias across a small table, one hand resting on a completely "
 "blank white folded envelope on her knee, her jaw set; Elias leans forward "
 "with one hand open, counting something off, his face hard. Nobody else is "
 "in the carriage. Green forest light through the glass, warm varnished wood.",
 ["hannah", "elias"])

scene("schnee-im-juli-auf-der-zugspitze",
 "The summit of the Zugspitze in July, deep old snow underfoot and a flat "
 "field of white cloud lying all around below the peak. A plain iron summit "
 "cross with no plaque and no markings stands against the sky. Hannah walks a "
 "few steps out through the snow with dark sunglasses on, her boots sinking "
 "deep; Elias stands still holding his gloves in one hand, watching her, not "
 "laughing. Hard white high altitude light, deep blue sky, sharp shadows.",
 ["hannah", "elias"])

scene("die-hutte-am-eibsee",
 "Night inside a tiny one room wooden hut by the lake, a fire burning in a "
 "small iron stove and a single candle on a shelf; a round paper lantern "
 "hangs at the black window. Hannah sits on the floorboards close to the "
 "fire, her hands still; Elias stands behind her laying a thick woollen "
 "blanket over her shoulders, a kettle steaming on the stove. There is no "
 "paper, no map, no letter and no envelope anywhere in the room. Deep warm "
 "orange firelight against the black window.",
 ["hannah", "elias"])

assert len(SCENES) == 21, len(SCENES)
for slug, body in SCENES:
    with open(os.path.join(OUT, slug + ".txt"), "w") as f:
        f.write(body + "\n")
print("wrote", len(SCENES), "scene files to", OUT)
