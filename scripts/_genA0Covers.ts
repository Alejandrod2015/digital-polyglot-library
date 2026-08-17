import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { generateFluxImageBuffer } from "../src/lib/coverGenerator";
import { uploadPublicObject } from "../src/lib/objectStorage";
const p:any=new PrismaClient();
const J="cmqrtaj1p000032qtda86z6um";
const STYLE = "STYLE (critical): clean digital editorial illustration, smooth flat cel shading and soft gradients, crisp clean linework, flat vivid but warm color fields, polished vector-like finish, bright and cheerful, adult realistic proportions. ABSOLUTELY NO oil painting, NO gouache, NO painterly brushstrokes, NO canvas texture, NO paper grain, NO impasto, NO visible brush marks, NO sketchy pencil texture. Smooth and clean only. Landscape composition, no text, no logos.";
const SCENES: Record<string,string> = {
"colores-en-el-barrio":"A cheerful neighborhood street in Barranquilla, Colombia decorated for Carnival. A Colombian teenage boy (Camilo) and his family hang colorful paper flowers and streamers; his mother proudly holds up a festive carnival costume covered in bright red and yellow feathers. Warm festive daylight, pastel houses, a few neighbors in the background, joyful mood.",
"el-desfile":"A lively Carnival parade in Barranquilla, Colombia. A Colombian teenage boy (Camilo) dances in the street with his dance group in colorful costumes; a happy crowd claps, with drums and giant butterfly and flower floats behind. Bright sunny day, confetti in the air, energetic and joyful.",
"despues-del-carnaval":"A calm Colombian home patio the morning after Carnival. A teenage boy (Camilo) rests with his family; the grandmother pours coffee, leftover confetti and flowers on the ground, Camilo looks at parade photos on a phone. Soft warm afternoon light, content peaceful mood.",
"otra-vez-al-mercado":"A traditional Mexican market food stall. A young woman with long brown hair in a white t-shirt (Ana) confidently orders from a smiling older female vendor with gray hair in a bun and a green apron; on the counter a chicken taco with green salsa and a tall glass of creamy white horchata. Bright warm daylight, colorful awnings, cheerful and confident mood.",
"ana-es-la-guia":"A traditional Mexican market food stall. A young woman with long brown hair in a white t-shirt (Ana) acts as a friendly guide for her curious friend Carla (another young woman); the smiling older vendor in a green apron hands over two tacos on plates. Bright warm daylight, colorful market awnings, friendly and proud mood.",
"la-noche-sin-luz":"A cozy Caribbean home in Cartagena, Colombia during a nighttime tropical storm with no electricity. By warm candlelight a grandmother opens an old box full of vintage family photographs while a curious girl (Lucia) watches closely. Rain on the window, soft golden candle glow, intimate slightly mysterious mood.",
"el-hombre-de-la-foto":"A bright living room in Cartagena by day. A girl (Lucia) and her mother sit together looking at an old photograph of a young man holding a guitar; the mother looks thoughtful and a little nostalgic. Warm daylight through the window, tender quiet mood.",
"la-llamada":"A bright living room in Cartagena. A girl (Lucia) holds a phone to her ear with a big happy smile; her mother sits beside her, moved and smiling. A framed photo of a man with a guitar nearby. Warm daylight, joyful emotional mood.",
"la-leyenda-de-la-tia":"A warm Oaxacan home interior at night. An aunt (tia Rosa) tells a legend to the family gathered around a wooden table; a colorful carved Mexican alebrije figurine sits on the table, and a boy (Mateo) listens with wide curious eyes. Candlelight, cozy and mysterious mood, Mexican folk-art details.",
"el-animal-de-madera":"A boy's bedroom in Oaxaca at night under strange moonlight. A boy (Mateo) lies awake in bed looking nervously toward a colorful carved wooden Mexican alebrije figurine on a nearby table. Cool blue moonlight through the window, suspenseful and magical mood.",
"la-tia-lo-confiesa":"A sunny Oaxacan home patio by day. A warm aunt (tia Rosa) laughs gently as she shows a colorful carved wooden Mexican alebrije figurine to a boy (Mateo), sharing a secret. Bright warm daylight, plants and folk-art details, affectionate cheerful mood.",
"la-plaza":"A famous leafy plaza in Buenos Aires on a Sunday. A shy young man (Pablo) sits on a bench; beside him a young woman (Marta) with a book starts a conversation; nearby a street musician plays a tango on guitar. Warm afternoon light, autumn trees, gentle inviting mood.",
"el-concierto":"An outdoor evening concert in a Buenos Aires park. A young man (Pablo) stands among a friendly group of young friends, smiling; a rock band plays on a small stage with colorful stage lights. Festive night atmosphere, warm glowing lights, energetic social mood.",
"el-cumpleanos-de-lucas":"A rooftop birthday party at dusk in Buenos Aires. A group of happy young friends raise their glasses in a toast on a terrace with balloons; the city skyline glows behind them. One young man (Pablo) is part of the group. Warm string lights, golden sunset light, celebratory warm mood.",
"el-sendero":"A summer mountain trail in Patagonia, Chile. A girl (Valentina) with a heavy backpack hikes up a path with her father; a huge condor glides in circles in the blue sky above. Tall trees, fresh green slopes, crisp sunny light, adventurous uplifting mood.",
"cuando-llega-la-lluvia":"A Patagonian lake landscape just after a storm. A girl (Valentina) and her father stand near a large rock by the lake, looking up at an enormous rainbow arching over the water. Clearing gray-blue sky, fresh wet light, hopeful awe-struck mood.",
"el-lago-azul":"A serene Patagonian lake with strikingly clear blue water and snow-capped mountains reflected like a mirror. A girl (Valentina) sits on a rock at the shore gazing peacefully at the view. Quiet pristine bright daylight, calm contemplative mood.",
"el-mapa":"A sunny central plaza in Cusco, Peru. A female tourist (Elena) holds a large confusing map looking lost; a friendly local man (Julio) with a warm smile points to give directions. Colonial stone architecture, Andean details, bright daylight, helpful warm mood.",
"el-taxi":"The narrow colorful streets of Cusco, Peru beside a taxi. A female tourist (Elena) looks out the taxi window in wonder while the friendly driver (Julio) gestures toward a stunning viewpoint over the city and mountains. Bright sunny day, colorful hillside houses, fascinated joyful mood.",
"el-tren-a-machu-picchu":"A female tourist (Elena) looks out the window of a train winding through green Andean mountains beside a fast river toward Machu Picchu; in the distance the ancient stone ruins sit among misty clouds. Lush green peaks, bright daylight, awe and wonder mood.",
};
async function main(){
  const slugs=Object.keys(SCENES);
  const ok:string[]=[]; const fail:string[]=[];
  for(const slug of slugs){
    const prompt = SCENES[slug] + " " + STYLE;
    let done=false;
    for(let attempt=1;attempt<=2 && !done;attempt++){
      try{
        const buf=await generateFluxImageBuffer(prompt);
        const key=`media/generated/images/${slug}-a0clean-${buf.length}.png`;
        const up=await uploadPublicObject({key,body:buf,contentType:"image/png"});
        if(!up) throw new Error("upload null");
        const url=`https://pub-ef067ab826f24d8fbe43b2ac2469bd3a.r2.dev/${key}`;
        const s=await p.journeyStory.findFirst({where:{journeyId:J,slug},select:{id:true}});
        await p.journeyStory.update({where:{id:s.id},data:{coverUrl:url,coverDone:true}});
        console.log(`OK ${slug} -> ${url}`);
        ok.push(slug); done=true;
      }catch(e:any){
        console.log(`  retry ${slug} (intento ${attempt}): ${e.message}`);
        if(attempt===2) fail.push(slug);
      }
    }
  }
  console.log(`\n=== ${ok.length} OK, ${fail.length} fallaron ${fail.length?": "+fail.join(", "):""}`);
  await p.$disconnect();
}
main().catch(e=>{console.error("FATAL",e.message);process.exit(1);});
