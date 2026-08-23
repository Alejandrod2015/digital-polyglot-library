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
    "VISUAL REGISTER (match the approved reference covers exactly): flat "
    "saturated colour fields, thick clean confident linework, strong clear "
    "northern daylight, cool clean whites, figures seen at mid distance as "
    "part of the place and never as a portrait, generous empty air around "
    "them, absolutely no texture, no grain, no brush marks."
)

SKIN_FRAMING = """SKIN (absolutely critical, higher priority than anything else in the scene):
every face has pale, cool, completely flat matte skin in ONE single uniform
tone; the cheeks are the exact same pale colour as the forehead, the nose and
the chin, or even paler; there is ZERO colour difference on the cheeks. NO
blush, NO rosy cheeks, NO pink cheeks, NO orange cheeks, NO warm cheek tint, NO
circular patch of colour on the cheeks, NO flushed skin, NO freckles, NO spots
of any kind, NO makeup. The cheeks look plain and uncoloured.

FRAMING AND EXPRESSION (critical): the people are seen at mid distance as part
of the place, with air around them; they are shown in a three quarter view so
both eyes and the iris are clearly visible; they are NEVER in full side
profile, they NEVER look at the camera or the viewer, and they are NEVER lined
up posing frontally for a portrait. Their faces are calm, quiet and neutral;
they are NOT smiling, NOT grinning and NOT beaming."""

NOTEXT = (
    "NO WRITING ANYWHERE (critical): there are no signs, no boards, no "
    "posters, no menus, no price tags, no labels, no newspapers, no books, "
    "no screens, no house numbers, no painted hull numbers and no lettering "
    "of any kind anywhere in the picture, not even blurred or in the far "
    "background."
)

FICHA = {
"hannah": ("Hannah, a woman of 32, straight dark brown hair cut just below the "
 "shoulders with a centre parting and no fringe, smooth even skin in one "
 "uniform tone, almond eyes with a dark brown iris and clear eyebrows; she "
 "always wears the same clothes: a mustard yellow jacket over a white "
 "t-shirt, dark blue jeans, and a small dark green canvas backpack"),
"elias": ("Elias, a man of 33, short black hair, clean shaven with no beard and "
 "no moustache, slim and tall, almond eyes with a dark brown iris; he always "
 "wears the same clothes: a dark teal zip jacket over a grey t-shirt and "
 "black jeans"),
"sophie": ("Sophie, a woman of 30, long chestnut brown hair tied in a low "
 "ponytail with no fringe, smooth even skin, almond eyes with a hazel iris; "
 "she always wears the same clothes: a coral red cardigan over a white blouse "
 "and dark grey trousers"),
"noah": ("Noah, a man of 34, short light brown hair, clean shaven with no beard, "
 "broad and calm, almond eyes with a green iris; he always wears the same "
 "clothes: a forest green fleece work vest over a beige shirt and brown work "
 "trousers"),
"emilia": ("Emilia, a woman of 34, YOUNG and clearly in her mid thirties, with a "
 "very short modern cropped haircut that is deliberately dyed a cool steel "
 "silver; her face is smooth and completely unlined, no wrinkles, no eye "
 "bags, no sagging skin, she is NOT an elderly woman and must not be drawn as "
 "one; almond eyes with a grey blue iris; she always wears the same clothes: "
 "a grey linen shirt with rolled sleeves and blue jeans"),
"leon": ("Leon, a man of 35, short dark blond hair, clean shaven with no beard, "
 "broad shoulders and large working hands, almond eyes with a blue iris; he "
 "always wears the same clothes: a navy blue knitted sweater and dark work "
 "trousers"),
"marie": ("Marie, a woman of 48, middle aged and NOT elderly, dark brown hair "
 "with no grey pinned up in a loose bun, smooth skin with only soft laugh "
 "lines, almond eyes with a dark brown iris; she always wears the same "
 "clothes: a plum purple apron over a cream blouse and a long dark skirt"),
}

def cast_block(keys, extras=None):
    people = [FICHA[k] for k in keys] + list(extras or [])
    n = len(people)
    head = ("CAST (exactly %d people in the picture and nobody else at all; "
            "every one of them is described here and every one of them is an "
            "adult between 25 and 55; no children, no teenagers, no elderly "
            "people, no extra figures, no crowd, no silhouettes in the "
            "background). Every single person on this list MUST actually be "
            "drawn in the picture, with exactly the gender, age, hair and "
            "clothes stated here: " % n)
    return head + "; ".join(people) + "."

SCENES = []
def scene(slug, action, keys, extras=None):
    SCENES.append((slug, "\n\n".join([action.strip(), cast_block(keys, extras), SKIN_FRAMING, REGISTER, NOTEXT])))

# --- Topic 1: Dresden ---------------------------------------------------
scene("wieder-in-dresden",
 "Late afternoon on the wide stone square in front of the great domed "
 "Frauenkirche in the old town of Dresden, pale baroque sandstone facades all "
 "around. Seen from across the square: Hannah and Elias walk slowly side by "
 "side without speaking, a friendly arm's length apart, both facing ahead in "
 "three quarter view, mouths closed, the silence after an argument. Off to "
 "one side of the square, clearly visible in the picture, a street musician "
 "stands playing a violin with his instrument case shut on the ground beside "
 "him. Warm low sunlight on the pale sandstone.",
 ["hannah", "elias"],
 ["the street musician, a man of 30 with short curly black hair, clean "
  "shaven, wearing a rust orange shirt and dark trousers, standing and "
  "playing a violin with his eyes on the strings"])

scene("die-brucke-uber-die-elbe",
 "Early morning on the long old stone bridge over the river Elbe in Dresden, "
 "grey mist lying low on the water. On the far bank stands the dark "
 "silhouette of the Dresden old town: the big round dome of the Frauenkirche, "
 "the slim openwork tower of the Hofkirche and the square blocky palace "
 "tower; there is NO gothic cathedral and NO twin pointed spires anywhere in "
 "the picture. Hannah has stopped in the middle of the bridge with both hands "
 "on the parapet, her head turned in three quarter view so both her eyes are "
 "clearly visible, her face calm and closed; Elias stands beside her, also in "
 "three quarter view, one arm stretched out pointing across the water. A "
 "single walker in a red coat passes behind them along the bridge. A long low "
 "riverboat slides underneath. Cool silver morning light.",
 ["hannah", "elias"],
 ["the walker, a woman of 30 with short black hair in a red coat, walking "
  "away from the viewer along the bridge"])

scene("die-treppe-an-der-elbe",
 "Warm summer evening on the broad old stone steps that run down to the river "
 "Elbe in Dresden. Hannah and Elias sit together on the steps a friendly "
 "distance apart, both in three quarter view with calm neutral faces, looking "
 "out at the dark water where a small boat glides past with no lights on. "
 "Further along the same steps a young man sits alone playing an acoustic "
 "guitar; this third figure is a man, not a woman. The last orange light of the "
 "day on the water.",
 ["hannah", "elias"],
 ["the guitar player, a young man of 27, with short brown hair, clean "
  "shaven, wearing a blue t-shirt and jeans, sitting on the steps playing an "
  "acoustic guitar"])

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
scene("maries-lebkuchen-am-hauptmarkt",
 "A busy Friday morning at a gingerbread stall on the big market square in "
 "Nuernberg, the ornate church front behind. The stall counter is stacked "
 "with round gingerbread biscuits and colourful old painted tin boxes "
 "decorated only with simple flower patterns and no writing at all; there are "
 "no price signs, no boards and no labels anywhere on the stall. Marie leans "
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
 "bench beside it. Marie watches from close by with her hands folded, "
 "speaking quietly; Hannah stands next to her looking down at the little "
 "figure. Warm orange glow from the metal against cool grey stone.",
 ["hannah", "marie"],
 ["the craftsman, a man of 52 with short dark brown hair and no grey, clean "
  "shaven with no beard, a lean lined face that is clearly middle aged and "
  "not old, wearing a heavy brown leather apron over a blue shirt"])

scene("bratwurst-am-kettensteg",
 "Midday on the stone steps at the water's edge beside the old iron chain "
 "footbridge hanging over the narrow river in Nuernberg, thin grey smoke from "
 "a grill drifting through the lane behind. Marie and Hannah sit side by side "
 "on the steps, each holding a bread roll with small grilled sausages in it; "
 "Marie is chewing slowly and looking at the water with wet eyes; Hannah has "
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
