// Spanish proper noun filter.
//
// Stories use lots of character names ("Carla", "Andrés"), Latin
// American/Iberian place names ("Coyoacán", "Lisboa"), and brand /
// landmark names ("ADO", "Bellas Artes"). The body-level-frequency
// validator would flag these as out-of-level vocab if we didn't filter
// them out. They are NOT teaching content; they're context.
//
// This file lists the most common Spanish first names + Latin American
// + Iberian toponyms + cultural landmarks that appear in DPL stories.
//
// Lookup is case-insensitive after lowercasing. Used by
// `extractSpanishContentWords` in spanishLevelJudge.ts.

export const SPANISH_PROPER_NOUNS: ReadonlySet<string> = new Set([
  // === Common Spanish first names (M) ===
  "alejandro","alex","alberto","alfonso","alfredo","alonso","álvaro","andrés","ángel","antonio",
  "armando","arturo","augusto","benjamín","bernardo","bruno","camilo","carlos","cesar","césar",
  "claudio","cristóbal","daniel","dario","darío","david","diego","domingo","eduardo","emilio",
  "enrique","ernesto","esteban","felipe","fernando","francisco","gabriel","gerardo","gonzalo",
  "gregorio","guillermo","gustavo","héctor","horacio","hugo","ignacio","iván","ivan","jaime",
  "javier","jerónimo","jesús","joaquín","jorge","josé","jose","juan","juancarlos","julián",
  "julio","leandro","leonardo","leopoldo","liam","lorenzo","lucas","luis","manolo","manuel",
  "marco","marcos","mariano","mario","martín","mateo","matías","mauricio","maximiliano",
  "miguel","moisés","moritz","nicolás","nico","noé","octavio","omar","óscar","oscar",
  "pablo","patricio","pedro","rafael","ramiro","ramón","raúl","ricardo","roberto","rodolfo",
  "rodrigo","rolando","rubén","ruben","salvador","samuel","santiago","sebastián","sergio",
  "simón","teo","teobaldo","tomás","ulises","valentín","víctor","vicente","vladimir","xavier",
  "yago","zacarías",

  // === Common Spanish first names (F) ===
  "adriana","alejandra","alicia","amanda","ana","andrea","ángela","antonia","ariana","aurora",
  "beatriz","blanca","camila","candela","carla","carmen","carolina","catalina","cecilia",
  "celia","clara","claudia","cristina","daniela","diana","dolores","elena","elisa","elsa",
  "emilia","emma","esmeralda","esperanza","estela","eugenia","eva","fátima","fernanda",
  "florencia","francisca","gabriela","gloria","graciela","guadalupe","helena","inés","irene",
  "isabel","jazmín","jimena","josefina","josefa","juana","julia","julieta","laura","leticia",
  "lidia","lilia","lina","lola","lorena","lucía","lucia","luisa","luna","magdalena",
  "manuela","margarita","maría","marina","marisol","marta","martina","matilde","mercedes",
  "miranda","mónica","monica","nadia","natalia","nélida","nora","norma","olga","paloma",
  "paola","patricia","paula","pilar","raquel","rebeca","regina","renata","rocío","rosa",
  "rosario","sara","silvia","sofía","sol","soledad","susana","teresa","valentina","valeria",
  "vanesa","verónica","victoria","violeta","virginia","ximena","yolanda","zaira",

  // === Latin American capitals & major cities ===
  "buenos","aires","caracas","bogotá","bogota","lima","quito","santiago","montevideo","asunción",
  "asuncion","la paz","sucre","brasilia","brazilia","ciudad","méxico","mexico","habana","havana",
  "panamá","panama","san salvador","tegucigalpa","managua","san josé","ciudad de guatemala",
  "santo domingo","san juan","tijuana","guadalajara","monterrey","puebla","veracruz","mérida",
  "merida","cancún","cancun","oaxaca","puebla","toluca","leon","león","aguascalientes",
  "querétaro","queretaro","morelia","saltillo","torreón","torreon","culiacán","culiacan",
  "chihuahua","durango","mexicali","ensenada","mazatlán","mazatlan","tampico","matamoros",
  "rosario","córdoba","cordoba","mendoza","tucumán","tucuman","salta","mar del plata",
  "bariloche","ushuaia","calafate","cartagena","medellín","medellin","cali","barranquilla",
  "santa marta","arequipa","trujillo","cusco","cuzco","iquitos","valparaíso","valparaiso",
  "concepción","concepcion","viña del mar","temuco","puerto montt","punta arenas","antofagasta",
  "iquique","la serena","guayaquil","manta","cuenca","ambato","loja","ibarra",
  "maracaibo","valencia","barquisimeto","mérida","san cristóbal","cumana","puerto la cruz",

  // === Spanish (Iberian) cities & regions ===
  "madrid","barcelona","sevilla","valencia","zaragoza","málaga","malaga","murcia","palma",
  "las palmas","bilbao","alicante","córdoba","valladolid","vigo","gijón","gijon","hospitalet",
  "vitoria","granada","oviedo","badalona","cartagena","terrassa","jerez","sabadell","santa cruz",
  "elche","pamplona","fuenlabrada","almería","almeria","leganés","san sebastián","getafe",
  "burgos","santander","castellón","albacete","alcorcón","tarragona","logroño","logrono",
  "huelva","mataró","mataro","badajoz","salamanca","huesca","lleida","cádiz","cadiz",
  "lugo","jaén","jaen","ourense","cáceres","caceres","melilla","ceuta",
  // Spanish regions / autonomies
  "andalucía","andalucia","cataluña","cataluna","galicia","euskadi","navarra","aragón","aragon",
  "asturias","cantabria","la rioja","castilla","extremadura","mancha","baleares","canarias",
  "mallorca","menorca","ibiza","formentera","tenerife","fuerteventura","lanzarote","gomera",

  // === Iberian cultural / landmark proper nouns ===
  "alhambra","sagrada","familia","prado","reina","sofía","sofia","retiro","gran","vía","via",
  "ramblas","ramblas","barri","gótico","gotico","raval","barceloneta","montjuïc","montjuic",
  "tibidabo","camp","nou","bernabéu","bernabeu","calatrava","oceanográfico","oceanografico",
  "alcázar","alcazar","albayzín","albayzin","sacromonte","triana","macarena","feria",
  "santiago","compostela","escorial","ávila","avila","toledo","cuenca","segovia","aranjuez",

  // === Latin American neighborhoods, plazas, landmarks ===
  "miraflores","barranco","san isidro","callao","chorrillos","surco","la victoria",
  "polanco","coyoacán","coyoacan","xochimilco","condesa","roma","nativitas","tepoztlán","tepoztlan",
  "tepozteco","altamira","jalatlaco","caminito","palermo","recoleta","belgrano","tigre",
  "san telmo","la boca","lavapiés","lavapies","chueca","malasaña","malasana",
  "lapa","alfama","bairro alto","mouraria","baixa","belém","belem","sintra","cascais",
  "santa teresa","copacabana","ipanema","leblon","tijuca","cinelândia","cinelandia",
  "providencia","las condes","ñuñoa","nunoa","bellavista","lastarria","valparaíso","valparaiso",
  "candelaria","monserrate","cerro","usaquén","usaquen","zona","rosa","g","macarena",
  "garibaldi","insurgentes","reforma","alameda","zócalo","zocalo","constitución","constitucion",
  "ADO","ado","metro","bellas","artes","alcalá","alcala","puerta del sol","sol",
  "tepoztlán","mérida","valparaíso","valladolid","tampico","monterrey","tijuana","puebla",
  "obispo","correos","cibeles","colón","colon","kennedy","castellana","azca","cuzco",
  "machu","picchu","sacsayhuamán","sacsayhuaman","ollantaytambo","aguas","calientes",

  // === Days, months (high-frequency capitalized in Spanish too) ===
  "enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre",
  "noviembre","diciembre",
  "lunes","martes","miércoles","miercoles","jueves","viernes","sábado","sabado","domingo",

  // === Brands / chain stores often used in DPL stories ===
  "google","facebook","instagram","twitter","whatsapp","tiktok","spotify","netflix","amazon",
  "uber","cabify","didi","rappi","mercadolibre","walmart","oxxo","seven","starbucks",
  "mcdonalds","pemex","ypf","copec","shell","esso","movistar","claro","telcel","tigo",
  "iberia","aeroméxico","aeromexico","latam","avianca","copa","lan","aeroflot",
]);

/** Case-insensitive check. */
export function isSpanishProperNoun(word: string): boolean {
  return SPANISH_PROPER_NOUNS.has(word.toLowerCase().trim());
}
