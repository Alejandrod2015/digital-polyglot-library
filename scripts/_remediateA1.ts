import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const J = "cmqp6hal8000032cb4ywfs0gc";

const SYN: Record<string,string> = {
  "sabado-de-mercado": "Sofía y Renata comparten departamento y casi nunca gastan en lujos. Un sábado salen juntas al mercado del barrio a comprar fruta para el desayuno, y ahí aparece la pequeña discusión de siempre: ella quiere los mangos caros, su amiga prefiere los plátanos baratos. Lo resuelven entre risas, sin apuro, y vuelven a casa con la bolsa llena y buen humor para empezar el fin de semana.",
  "no-hay-cafe": "El desayuno del sábado va tomando forma en la cocina pequeña, hasta que las dos amigas descubren que no queda nada de café y que la tienda de la esquina no abre hasta dentro de una hora. Para ellas, la mañana sin café no es lo mismo, y un vaso de agua tampoco ayuda. Justo cuando empiezan a resignarse, alguien toca la puerta y, desde el pasillo, llega un olor a algo recién hecho.",
  "mateo-trae-pan-dulce": "Quien toca la puerta tan temprano es Mateo, el amigo de las dos, que llega con una bolsa grande de pan dulce de la panadería y, mejor todavía, con el café que les faltaba. Lo que parecía un desayuno a medias se convierte de pronto en una mesa llena para tres, con conchas, fruta y café recién hecho, y la promesa de que la próxima vez ellas ponen el pan.",
  "se-fue-la-luz": "Es una tarde de lluvia en Bogotá y la familia está encerrada en casa cuando, de golpe, se va la luz en todo el edificio. Marina se queja porque se queda sin internet y a su hermano casi no le queda batería en el teléfono. Su mamá, en cambio, saca unas velas y propone otra manera de pasar la tarde, contando historias de cuando era niña. El apagón termina siendo lo mejor del día.",
  "una-caja-vieja": "Una tarde de limpieza se vuelve algo más cuando Marina, ordenando un clóset viejo, encuentra una caja con papeles antiguos y una foto en blanco y negro. La joven que sale bailando en la imagen es su propia mamá, muchos años atrás, en una fiesta del barrio. El trapo queda olvidado mientras madre e hija se sientan a mirar las fotos, y empieza a salir una historia familiar que Marina jamás había escuchado.",
  "por-fin-se-abre-la-puerta": "Desde temprano se oyen golpes y ruidos raros en el cuarto de Julián, y cada vez que alguien pregunta, él cierra la puerta sin dejar entrar a nadie. Marina está convencida de que su hermano esconde alguna travesura sin sentido. Pero cuando por fin abre, con las manos sucias y una sonrisa enorme, lo que tenía escondido resulta ser un regalo hecho a mano: una vieja silla de la familia, arreglada para su mamá.",
  "cafe-para-dos": "Un sábado por la tarde, casi todas las mesas del café del centro están ocupadas y solo queda una silla libre, al lado de un desconocido. Camila pide permiso para sentarse y, sin planearlo, termina conversando con Tomás, un chico tranquilo que trabaja en una librería del mismo barrio. De una simple pregunta sobre el café nace un rato agradable entre dos personas que recién se conocen y quedan en volver a verse.",
  "quien-escribio-este-libro": "Camila por fin visita la librería de Tomás para buscar cuentos sencillos que leerles a sus alumnos. Él insiste en recomendarle un libro que ella no conoce y, al principio, ella duda en llevarlo. Solo cuando abre la primera página y descubre una foto adentro entiende quién es en realidad ese vendedor tímido que tiene enfrente. La visita cambia por completo la idea que se había hecho de su nuevo amigo.",
  "las-nueve-y-cinco": "Camila llama a Tomás con un plan: que vaya a su escuela el viernes a leerles su propio cuento a los alumnos. A Tomás la idea le da miedo, porque nunca leyó su libro en voz alta delante de nadie, pero al final acepta. Llega el viernes, los chicos esperan en la puerta, el reloj marca las nueve y cinco y de Tomás todavía no hay ninguna señal. Camila empieza a preocuparse de verdad.",
  "buscando-el-mar": "Diego lleva media hora dando vueltas por una zona nueva de Lima, con un mapa en la mano y sin encontrar el mar que tanto quiere ver. Una vecina, Pilar, lo nota desde la esquina y se ofrece a guiarlo paso a paso por la avenida. Mientras caminan, Diego está seguro de que el mar queda lejísimos, sin imaginar que la mejor vista de la ciudad lo espera a la vuelta del parque.",
  "el-micro-junto-al-mar": "Pilar y Diego alcanzan por poco un micro lento que cruza uno de los barrios más bonitos de Lima. El viaje es pausado, pero desde la ventanilla se ve la ciudad despertar: casas de colores, calles tranquilas y, al fondo, el mar escondido. Don Beto, que maneja, los deja justo en la plaza. Una mañana sencilla que les recuerda que, a veces, el camino importa tanto como el lugar al que uno va.",
  "una-fiesta-sin-aviso": "Pilar y Diego cruzan el centro de Lima buscando una calle tranquila para hacer un trámite aburrido. Pero al doblar una esquina se topan de frente con algo que no esperaban: una feria llena de música, baile y puestos de colores. El mandado serio y la celebración alegre se cruzan en la misma plaza, y los dos terminan eligiendo quedarse un rato entre la gente antes de seguir con sus cosas.",
  "el-barrio-se-prepara": "Una tarde entera colgando cintas y barriendo el patio bajo un calor pesado: para Daniela, la fiesta del barrio se siente más como un trabajo que no le toca que como algo suyo. Andrés, en cambio, le pone cariño a cada globo. Cuando él le cuenta a quién están celebrando y todo lo que esa mujer hizo por el vecindario, Daniela deja de ver una tarea pesada y empieza a ver una forma de dar las gracias.",
  "por-fin-empieza-la-fiesta": "La fiesta por fin empieza y doña Rosa entra a su propio patio entre aplausos. Para Daniela es una desconocida, pero para Andrés es la mujer que lo cuidó cuando era niño, y el reencuentro entre los dos lo deja claro enseguida. Mientras la anciana saluda a un barrio entero que la quiere, Daniela canta y aplaude con los demás y descubre, en una sola tarde, lo que significa empezar a pertenecer a un lugar.",
  "alguien-toca-el-porton": "La fiesta llega a su mejor momento y doña Rosa está por apagar las velas cuando un golpe seco en el portón de hierro corta la música de repente. Afuera espera un hombre con una maleta, llegado desde muy lejos, que pregunta por ella. Su voz le suena a doña Rosa de un tiempo muy antiguo, y el barrio entero contiene la respiración esperando saber quién es ese desconocido parado en la puerta.",
  "lo-que-hay-tras-la-subida": "Javiera y Benjamín suben una montaña helada, cansados del viento, del frío y de una cuesta que parece no terminar nunca. Su tía Gloria, que conoce bien el lugar, camina tranquila y les pide un poco de calma. Cuando el sendero por fin se abre, lo que aparece allá abajo los deja a los tres sin palabras y borra de golpe todo el cansancio: una vista que muy pocos llegan a ver.",
  "cuando-llega-la-tormenta": "A mitad del camino de bajada, una tormenta cae de golpe y deja a Javiera y a Benjamín mojados, helados y listos para dar media vuelta hacia el pueblo. Su tía Gloria, en cambio, les pide solo unos minutos de paciencia bajo un árbol, segura de algo que ellos todavía no entienden. La decisión de quedarse, tan difícil bajo la lluvia, acaba regalándoles la vista más limpia y brillante de todo el viaje.",
  "nadie-quiere-dormir-todavia": "Cuando cae la noche, Benjamín enciende una fogata y los tres se sientan alrededor del fuego, agotados pero felices después de un día entero de caminata. Sobre ellos, el cielo se llena de más estrellas de las que Javiera había visto nunca. Entre el calor de las llamas y los viejos recuerdos que cuenta su tía, la velada se transforma en uno de esos momentos sencillos que uno no quiere que terminen jamás.",
  "la-luz-en-el-cerro": "Junto al fuego, su tía cuenta la vieja leyenda de una luz que aparece de noche en el cerro y que, según dicen, ayuda a los viajeros perdidos. Rodrigo se asusta, pero Itzel quiere ver esa luz con sus propios ojos. Cuando los dos suben la colina oscura siguiendo el resplandor, lo que encuentran allá arriba no es ningún ser de otro mundo, sino una verdad mucho más humana y mucho más bonita.",
  "el-animal-de-madera-se-mueve": "Su tía les regala una figura de madera pintada de mil colores y, medio en broma, les dice que de noche cuida la casa y se mueve sola. Itzel no cree ni una palabra; Rodrigo, por las dudas, la deja mirando hacia la puerta. A la mañana siguiente, la figura mira hacia otro lado, y ninguno de los dos la tocó. El misterio queda abierto mientras la tía canta en el patio como si nada.",
  "la-tia-lo-confiesa-todo": "Decididos a resolver el misterio, los primos encuentran a su tía pintando otra figura en el patio. Entre risas, ella confiesa la verdad: no hay nada raro, es ella quien mueve las figuras cada noche. Pero detrás de la pequeña broma hay algo más grande, una forma de lograr que sus sobrinos pregunten, escuchen y guarden las viejas historias de la familia. La mañana termina con los tres pintando juntos bajo el sol tibio.",
};

type Entry = { type: string; word: string; surface?: string; definition: string };
const VOCAB: { slug: string; remove: string[]; add: Entry[] }[] = [
  { slug: "nadie-quiere-dormir-todavia", remove: ["mundo","rico"], add: [
    { type:"adjective", word:"mejor", definition:"Better or best; nicer or more good than the other choices you have." },
    { type:"adjective", word:"rico", definition:"Tasty and delicious; food or drink that is very nice to eat." } ]},
  { slug: "la-luz-en-el-cerro", remove: ["arriba","nieto"], add: [
    { type:"adverb", word:"arriba", definition:"Up or above; toward a higher place over your own head." },
    { type:"noun", word:"sobrino", surface:"sobrinos", definition:"Nephew; the son of your brother or sister, for an aunt or uncle." } ]},
  { slug: "el-animal-de-madera-se-mueve", remove: ["sola"], add: [
    { type:"adjective", word:"sola", definition:"Alone; when someone or something is by itself with nobody else near." } ]},
  { slug: "alguien-toca-el-porton", remove: ["música"], add: [
    { type:"noun", word:"maleta", definition:"Suitcase; the big bag you fill with clothes to take on a trip." } ]},
  { slug: "cuando-llega-la-tormenta", remove: ["charco"], add: [
    { type:"verb", word:"brillar", surface:"brilla", definition:"To shine; to send out bright light, like the sun or a star." } ]},
  { slug: "el-barrio-se-prepara", remove: ["vecina"], add: [
    { type:"noun", word:"vecina", definition:"Neighbor; a woman who lives in a home very close to yours." } ]},
  { slug: "las-nueve-y-cinco", remove: ["niño"], add: [
    { type:"noun", word:"alumno", surface:"alumnos", definition:"Student; a child who goes to school to learn from a teacher." } ]},
];

const cw = (t:string)=>(t.trim().split(/\s+/).filter(Boolean)).length;

(async () => {
  const p = new PrismaClient();
  const stories = await p.journeyStory.findMany({ where: { journeyId: J }, select: { id:true, slug:true, text:true, vocab:true } });
  const bySlug = new Map(stories.map(s=>[s.slug??"",s]));
  // global pill index to avoid new dups
  const pillCount = new Map<string,number>();
  for (const s of stories){ const v:any[]=Array.isArray(s.vocab)?s.vocab as any[]:[]; for(const x of v) pillCount.set(String(x.word).toLowerCase(),(pillCount.get(String(x.word).toLowerCase())??0)+1); }

  console.log("=== SYNOPSIS ===");
  for (const [slug, syn] of Object.entries(SYN)) {
    const s = bySlug.get(slug); if (!s) { console.log(`!! ${slug} missing`); continue; }
    const w = cw(syn);
    await p.journeyStory.update({ where:{id:s.id}, data:{ synopsis: syn } });
    console.log(`${w>=45&&w<=90?"ok":"!!"} ${slug} (${w}w)`);
  }

  console.log("\n=== VOCAB ===");
  for (const { slug, remove, add } of VOCAB) {
    const s = bySlug.get(slug); if (!s?.text) { console.log(`!! ${slug} missing`); continue; }
    const body = s.text.toLowerCase();
    const vocab:Entry[] = Array.isArray(s.vocab)?s.vocab as any[]:[];
    for (const a of add) {
      const surf=(a.surface??a.word).toLowerCase();
      const dw = cw(a.definition);
      if (!body.includes(surf)) console.log(`   ⚠ ${slug}: "${surf}" no en cuerpo`);
      if (dw<8||dw>14) console.log(`   ⚠ ${slug}: def "${a.word}" ${dw}w fuera de 8-14`);
      // is this word a pill elsewhere already (excluding this story / words being removed here)?
      const elsewhere = stories.filter(x=>x.slug!==slug).some(x=>{const v:any[]=Array.isArray(x.vocab)?x.vocab as any[]:[];return v.some(p=>String(p.word).toLowerCase()===a.word.toLowerCase());});
      if (elsewhere) console.log(`   ⚠ ${slug}: "${a.word}" ya es pill en otra historia (dup nuevo)`);
    }
    const rm = new Set(remove.map(r=>r.toLowerCase()));
    const next = [...vocab.filter(v=>!rm.has(String(v.word).toLowerCase())), ...add];
    await p.journeyStory.update({ where:{id:s.id}, data:{ vocab: next as any, vocabCount: next.length } });
    console.log(`ok ${slug}: −${remove.join(",")} +${add.map(a=>a.word).join(",")} (=${next.length})`);
  }
  await p.$disconnect();
})().catch(e=>{ console.error(e); process.exit(1); });
