import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { parseDialogueSegments } from "../src/lib/elevenlabs";
const J = "cmqp6hal8000032cb4ywfs0gc";
const wc = (t: string) => (t.trim().match(/[A-Za-zÁÉÍÓÚÑáéíóúñü0-9]+/g) ?? []).length;
function ratio(text: string) { const s = parseDialogueSegments(text); let d = 0, n = 0; for (const x of s) { const w = wc(x.text); if (x.speaker === "narrator") n += w; else d += w; } return Math.round(d / (d + n || 1) * 100); }

const BODIES: Record<string,string> = {
"el-barrio-se-prepara": `Daniela barre el patio mientras Andrés cuelga unas cintas de colores. En Cartagena, Colombia, el calor de la tarde es muy fuerte. Hoy el barrio prepara el cumpleaños de doña Rosa.

Daniela: Llevamos toda la tarde en esto. Estoy cansada, Andrés.
Andrés: Lo sé, pero falta poco. ¿Me pasas esos globos?
Daniela: ¿De verdad viene tanta gente por un cumpleaños?
Andrés: Doña Rosa cumple ochenta años. Es muy querida acá.
Daniela: ¿Ochenta? Pensé que era más joven.
Andrés: Tiene mucha energía. Todavía cocina para medio barrio.

Andrés cuelga el último farol.

Daniela: No la conozco mucho. ¿Por qué la quieren tanto?
Andrés: Ella cuidó a medio barrio cuando éramos niños. A mí también.
Daniela: No tenía idea. Pensé que era una vecina más.
Andrés: Es mucho más que eso. Por eso adornamos todo con cariño.
Daniela: ¿Y ella sabe que le hacemos fiesta?
Andrés: No, es una sorpresa. Llega en una hora, así que apúrate.

Daniela mira el patio lleno de luces y banderas.

Daniela: Ahora lo veo distinto. Esto no es un trabajo aburrido.
Andrés: Exacto. Es una forma de decir gracias.
Daniela: Entonces sigo con ganas. ¿Dónde pongo estas flores?
Andrés: En la mesa del centro. Que doña Rosa las vea primero.

Daniela acomoda las flores en el florero y se queda mirando el patio lleno de luces.`,

"por-fin-empieza-la-fiesta": `La música suena y el patio se llena de vecinos. Doña Rosa entra despacio, con su vestido blanco, y todos aplauden. Daniela la ve de cerca por primera vez.

Rosa: ¡Cuántos años, mis niños! No esperaba a tanta gente.
Andrés: Es todo para usted, doña Rosa. El barrio entero la quiere.
Rosa: Andrés, ¿eres tú? El mismo niño que comía en mi cocina.
Andrés: El mismo, doña Rosa. Usted me daba pan cada tarde.
Rosa: Y tú siempre pedías dos pedazos de pan dulce.
Andrés: Me acuerdo de todo. Usted fue como una abuela para mí.
Rosa: Y mira ahora, todo un hombre. Cómo pasan los años.

Doña Rosa lo abraza fuerte, con los ojos húmedos.

Rosa: Cómo pasa la vida. Ahora tú adornas mi propia fiesta.
Daniela: Yo soy Daniela, su vecina nueva. Mucho gusto, señora.
Rosa: Bienvenida, mija. Esta casa siempre tiene la puerta abierta.
Daniela: Gracias. Ya entiendo por qué todos hablan de usted.
Rosa: Ven cuando quieras. Aquí siempre hay café y conversación.
Daniela: Voy a venir seguido, entonces. Me cae muy bien.

Doña Rosa levanta su vaso y mira a la gente.

Rosa: Lo más bonito de la vida son los buenos vecinos.
Andrés: ¡Que viva doña Rosa!
Daniela: ¡Que viva!

Todos aplauden y empiezan a cantar. Daniela canta su parte de la canción y siente el patio entero a su lado.`,

"alguien-toca-el-porton": `Doña Rosa está por apagar las velas cuando alguien golpea el portón de hierro. De pronto la fiesta queda en silencio. Andrés y Daniela miran hacia la reja.

Daniela: ¿Esperan a alguien más? Ya estamos todos.
Andrés: No que yo sepa. Voy a ver quién es.
Rosa: Dejen, yo abro. Es mi casa, después de todo.
Daniela: La acompaño, doña Rosa. Por si acaso.

Doña Rosa camina hasta el portón. Afuera, un hombre espera con una maleta.

Hombre: Buenas noches. Busco a la señora Rosa.
Rosa: Soy yo. ¿Y usted quién es, joven?
Hombre: ¿No se acuerda de mí? Vine desde muy lejos solo para verla.
Rosa: Esa voz... no puede ser verdad.
Hombre: Sí, doña Rosa. Pasaron muchos años, pero aquí estoy.
Rosa: Déjame verte bien. La luz de aquí es poca.

Doña Rosa se lleva la mano al pecho. El hombre deja la maleta en el suelo.

Daniela: Andrés, ¿tú sabes quién es este señor?
Andrés: Ni idea. Nunca lo vi por el barrio.
Daniela: Trae una maleta. Viene de muy lejos, seguro.
Daniela: Mira la cara de doña Rosa. Casi no puede hablar.
Daniela: Doña Rosa, ¿está bien? Se puso pálida.
Andrés: ¿Lo conoce, doña Rosa? ¿Quién es este señor?
Rosa: Es...

La música se detiene del todo. El barrio entero espera, en silencio, la próxima palabra de doña Rosa.`,

"lo-que-hay-tras-la-subida": `Hace mucho viento mientras Javiera y Benjamín suben el sendero. En Patagonia, Chile, el frío les muerde la cara. Su tía Gloria camina adelante, con su gorro y su abrigo grueso.

Javiera: Tía, ¿falta mucho? Estoy helada y cansada.
Gloria: Un poco más, Javiera. La montaña pide calma.
Benjamín: Yo ya casi no puedo con esta subida.
Gloria: Miren mejor ese bosque. Es muy hermoso.
Javiera: Es lindo, sí, pero tengo los pies congelados.
Gloria: Mueve los dedos al caminar. Así entran en calor.
Benjamín: ¿Tú ya conocías este lugar, tía?
Gloria: Vine de niña con mi padre. No lo olvidé nunca.

El sendero sube entre árboles y piedras grises. De pronto, el camino se abre.

Javiera: Esperen... ¿qué es eso de allá abajo?
Benjamín: No puede ser. ¡Un lago grande, de color azul!
Gloria: Ese es el premio. Pocos lo ven con sus propios ojos.
Javiera: Vale cada paso. Nunca vi un agua tan brillante.

Los tres se quedan callados frente al lago. El frío y el esfuerzo ya no importan.

Benjamín: Veníamos cansados y tristes, y nos esperaba todo esto.
Gloria: Así es la montaña. Primero cansa y después regala esto.
Javiera: Ya casi no siento el frío. Me quedo un rato más a mirar el agua.
Benjamín: Yo saco una foto, aunque sé que no va a salir igual.
Javiera: Igual me la quedo, para acordarme de este día.`,

"cuando-llega-la-tormenta": `Las nubes se vuelven negras y una tormenta cae sobre el valle. Javiera, Benjamín y Gloria se cubren bajo un árbol. La lluvia los deja mojados en pocos minutos.

Javiera: Esto es demasiado. Mejor volvamos al pueblo.
Benjamín: Estoy de acuerdo. Con esta tormenta no se puede caminar.
Gloria: Esperen un momento bajo el árbol. La tormenta de montaña pasa rápido.
Javiera: ¿Y si no pasa? Estoy mojada y muerta de frío.
Benjamín: Yo tampoco aguanto mucho. El agua ya me entra por el abrigo.
Gloria: Confíen en mí. Conozco bien este cielo.

Un relámpago cruza el cielo a lo lejos y un trueno suena muy fuerte. Luego, poco a poco, la lluvia baja y el viento del valle se calma.

Gloria: ¿Ven? Ya casi para. Miren hacia el valle.
Benjamín: Es verdad. El cielo se está abriendo de a poco.
Gloria: Después de cada tormenta, todo se ve más limpio.
Javiera: Es cierto. El valle entero brilla como recién lavado.
Benjamín: Y nosotros aquí, secándonos al sol. Casi nos vamos.

Salen de su árbol y siguen el camino entre charcos, con el sol otra vez afuera.

Javiera: Casi me devuelvo por unas nubes negras. Estaba muerta de frío.
Gloria: Te lo dije. La tormenta de montaña siempre pasa rápido.
Benjamín: Voy a recordar esto. Esperar un poco valió la pena.`,

"nadie-quiere-dormir-todavia": `La noche cae sobre el valle y Benjamín enciende una fogata. Las estrellas llenan todo el cielo, y Javiera y su tía Gloria se acercan al fuego con sus tazas.

Benjamín: Por fin un poco de calor. La leña estaba casi mojada.
Javiera: Qué rico. Después de caminar todo el día, esto es lo mejor del mundo.
Gloria: Miren hacia arriba. ¿Ven cuántas estrellas?
Javiera: Nunca vi tantas juntas. En la ciudad no se ven así.
Benjamín: Ahí hay una que se mueve. ¿Es un avión o una estrella?
Gloria: Es una estrella que cae. Pide un deseo, rápido.

El fuego crece y la leña suena despacio. Afuera el frío es fuerte, pero junto a la fogata todo es calor.

Gloria: Cuando era niña, mi padre me traía a este mismo valle.
Benjamín: ¿En serio? ¿Y dormían bajo las estrellas también?
Gloria: Sí. Cada noche me contaba una historia distinta.
Javiera: Cuéntanos una, tía. La noche todavía es larga.
Benjamín: Sí, una de las que te contaba tu padre.
Gloria: Está bien. Acérquense un poco más al fuego.

Gloria mueve la leña y el fuego sube. Los tres se quedan un rato en silencio, felices, mirando las estrellas.

Javiera: Cuéntanos una historia, tía. Estas noches no se olvidan.
Gloria: Bueno, les cuento la del lago. Pero guarda bien esta historia, Javiera.
Benjamín: Le echo más leña entonces. Nunca dormí con tanta paz como aquí.`,

"la-luz-en-el-cerro": `Esta noche, la tía Lucha cuenta una vieja leyenda junto al fuego. En Oaxaca, México, sus sobrinos Itzel y Rodrigo escuchan con los ojos muy abiertos. La historia habla de una luz que aparece en el cerro.

Tía Lucha: Dicen que esa luz ayuda a los viajeros perdidos.
Rodrigo: ¿Y si no es buena? Esas historias me asustan.
Itzel: No tengas miedo. Yo quiero ver esa luz.
Tía Lucha: Pues miren por la ventana. Justo ahora brilla en la colina.

Los dos sobrinos corren a la ventana. Una luz pequeña se mueve despacio por el cerro oscuro.

Rodrigo: ¡Es verdad! ¿Quién anda ahí a esta hora?
Itzel: Vamos a ver. Tú trae la linterna y yo voy adelante.
Rodrigo: ¿Estás segura? ¿Y si es algo malo?
Itzel: Sé valiente. Solo así vamos a saberlo.

Suben con cuidado y la sombra crece a su lado. Arriba hay un hombre viejo con una lámpara.

Don Pedro: Buenas noches, niños. ¿Ustedes también se perdieron?
Itzel: No, señor. Seguimos su luz desde la casa.
Rodrigo: ¿Usted es la luz de la leyenda? Pensé que era algo malo.
Don Pedro: Solo soy un viejo con su lámpara. La leyenda la pusieron ustedes.
Itzel: ¿Y por qué sube cada noche hasta aquí arriba?
Don Pedro: Subo a poner una luz. Así nadie se pierde en lo oscuro.
Rodrigo: ¿Y no le da miedo subir solo de noche?
Don Pedro: Ya no. El cerro y yo somos viejos amigos.

La tía Lucha los espera abajo, tranquila. La luz del cerro tenía dueño, y era don Pedro con su lámpara de siempre.`,

"el-animal-de-madera-se-mueve": `La tía Lucha les regala una figura de madera pintada de muchos colores. Dicen que estas figuras cuidan la casa por la noche. Itzel la pone sobre la mesa antes de dormir.

Itzel: Es hermosa. Mira cuántos colores tiene, Rodrigo.
Rodrigo: La tía Lucha dijo que se mueve cuando nadie mira.
Itzel: Eso es solo un cuento para niños. No te creas todo.
Rodrigo: Yo la dejo mirando a la puerta. Por si acaso.
Itzel: Como quieras. Yo me duermo sin ningún miedo.
Rodrigo: ¿Y si de verdad se mueve? Yo no quiero verlo.
Itzel: No va a pasar nada. Es madera pintada, nada más.

Los primos apagan la luz y se duermen; la figura se queda sola sobre la mesa. Por la mañana, Itzel se despierta primero y mira hacia la mesa.

Itzel: Rodrigo, despierta. ¿Tú moviste el animalito anoche?
Rodrigo: No, yo no toqué nada. ¿Por qué preguntas?
Itzel: Anoche miraba hacia la puerta. Ahora mira hacia la ventana.
Rodrigo: No puede ser. ¿Entonces la historia es verdad?
Itzel: No sé qué pensar. Yo la dejé mirando a la puerta, segura.

Los dos miran la figura en silencio, sin saber qué pensar. Afuera, la tía Lucha canta en el patio como si nada pasara.

Itzel: Vamos a preguntarle a la tía. Ella tiene que saber algo.
Rodrigo: Guarda un secreto, estoy seguro. Pero no lo va a decir fácil.
Itzel: Entonces hay que insistir. Esta historia no se queda así.`,

"la-tia-lo-confiesa-todo": `Por la mañana, los primos encuentran a su tía Lucha pintando otra figura en el patio. En Oaxaca, México, el sol entra tibio entre las plantas. Itzel y Rodrigo se sientan a su lado.

Rodrigo: Tía, dinos la verdad. ¿La figura se mueve sola?
Tía Lucha: Mis niños, la que mueve las figuras soy yo.
Itzel: ¿Tú? ¿Entonces no hay nada raro en todo esto?
Tía Lucha: No, ningún misterio. Lo bonito es otra cosa.
Rodrigo: ¿Y por qué nos asustaste con esa historia?
Tía Lucha: Para que escucharan. Las historias se quedan mejor así.

La tía Lucha ríe despacio y sigue pintando con su pincel.

Tía Lucha: Yo muevo la figura para que ustedes pregunten por ella.
Rodrigo: O sea que el animalito era una excusa para hablar.
Tía Lucha: Así es. Una leyenda vive solo si alguien la cuenta.
Itzel: Quiero aprender. Enséñame a pintar una figura, tía.
Tía Lucha: Con gusto. Elige tus colores y empezamos.

La tía Lucha les pasa un pincel y un poco de pintura a cada uno. Los tres pintan juntos, despacio, bajo el sol de la mañana.

Rodrigo: La mía va a cuidar mi cuarto allá en la ciudad.
Itzel: Y la mía va a guardar esta historia para siempre, aquí contigo.
Tía Lucha: Me parece bien. El año que viene pintamos otra figura.`,
};

(async () => {
  const p = new PrismaClient();
  for (const [slug, body] of Object.entries(BODIES)) {
    const s = await p.journeyStory.findFirst({ where: { journeyId: J, slug }, select: { id: true, vocab: true, dialogueSpec: true, audioStatus: true } });
    if (!s) { console.log(`!! ${slug} missing`); continue; }
    const spec: any = s.dialogueSpec; const allowed = new Set((Array.isArray(spec) ? spec.map((x: any) => String(x.speaker).toLowerCase()) : []));
    const speakers = [...new Set(parseDialogueSegments(body).map(x => x.speaker.toLowerCase()))].filter(x => x !== "narrator");
    const unknownSp = speakers.filter(x => !allowed.has(x));
    const v: any[] = Array.isArray(s.vocab) ? s.vocab as any[] : [];
    const low = body.toLowerCase();
    const missing = v.filter(x => { const sf = String(x.surface ?? x.word).toLowerCase(); return sf && !low.includes(sf); }).map(x => x.surface ?? x.word);
    const flags = [unknownSp.length ? `speaker fuera: ${unknownSp}` : "", missing.length ? `vocab fuera: ${JSON.stringify(missing)}` : ""].filter(Boolean).join(" | ");
    await p.journeyStory.update({ where: { id: s.id }, data: { text: body, wordCount: wc(body) } });
    console.log(`${flags ? "⚠️ " : "ok"} ${slug}: ${wc(body)}w, ${ratio(body)}% diálogo${flags ? "  " + flags : ""}`);
  }
  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
