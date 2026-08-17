import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { parseDialogueSegments } from "../src/lib/elevenlabs";
const J = "cmqp6hal8000032cb4ywfs0gc";
const wc = (t: string) => (t.trim().match(/[A-Za-zÁÉÍÓÚÑáéíóúñü0-9]+/g) ?? []).length;
function ratio(text: string) { const s = parseDialogueSegments(text); let d = 0, n = 0; for (const x of s) { const w = wc(x.text); if (x.speaker === "narrator") n += w; else d += w; } return Math.round(d / (d + n || 1) * 100); }

const BODIES: Record<string,string> = {
"se-fue-la-luz": `Marina mira la lluvia por la ventana de la sala. Es lunes en Bogotá, Colombia, y la tarde está gris. Su hermano Julián y su mamá están con ella en la casa.

Marina: Llueve muy fuerte. No me gusta este clima.
Mamá: Aquí siempre llueve por la tarde. Es muy normal.
Marina: Yo quería salir a caminar. Ahora no puedo.
Mamá: Paciencia. La lluvia pronto se va.
Marina: Igual no traje paraguas. Tampoco era día de salir.

De repente, todo se queda oscuro. Se apaga la luz en toda la casa.

Julián: Otra vez sin luz. Y mi teléfono ya casi no tiene batería.
Marina: ¿Y ahora qué hacemos? No hay internet ni nada.
Mamá: Tranquilos. Tengo unas velas en el cajón.
Julián: ¿Velas? ¿Y para qué las quieres, mamá?
Mamá: Para ver, hijo. Antes pasábamos muchas noches así.

Mamá enciende dos velas. La luz es suave y amarilla.

Mamá: ¿Ven? Así pasábamos las tardes cuando yo era niña.
Julián: Es verdad. Sin pantalla, la casa se siente más tranquila.
Marina: Mamá, cuéntanos una historia de cuando eras joven.
Mamá: Claro que sí. Vengan, siéntense cerca de la vela.
Julián: Esto me gusta. Nadie mira el teléfono ahora.
Marina: ¿Y de verdad no se aburrían sin tele?
Mamá: Para nada. Cantábamos y contábamos historias hasta tarde.

Al final, los tres se sientan cerca de la vela. Afuera sigue la lluvia; adentro, la luz amarilla es suave y cálida.

Marina: Sí, mamá, cuéntanos una de cuando eras niña.
Julián: Y mañana cargo el teléfono. Hoy lo dejo apagado.`,

"una-caja-vieja": `Marina abre la puerta del clóset viejo y saca una caja con polvo. Es sábado y ayuda a su mamá a ordenar el cuarto.

Mamá: Gracias por ayudarme. Este clóset es un desastre.
Marina: Tranquila. Entre las dos terminamos rápido.
Marina: A ver, aquí hay una caja vieja. ¿La abro?
Mamá: Sí, ábrela. No recuerdo qué hay adentro.

Marina abre la caja con cuidado. Adentro hay papeles, cartas y una foto en blanco y negro.

Marina: ¡Mamá! ¿Esta eres tú? Te ves muy joven aquí.
Mamá: A ver... Sí, soy yo. Tenía veinte años en esa foto.
Marina: ¡Estás bailando! Nunca me contaste que bailabas.
Mamá: Bailaba cada fin de semana. Me encantaba esa música.
Marina: ¿Y estas cartas? Hay muchas, todas a mano.
Mamá: Cartas de amigas de entonces. Antes nos escribíamos todo.
Marina: ¿Y quién es el muchacho a tu lado?
Mamá: Un viejo amigo. Eso te lo cuento otro día.

Mamá toma la foto y sonríe. Por un momento, los recuerdos vuelven a aquellos años.

Mamá: Cómo pasa el tiempo. Parece que fue ayer.
Marina: Te ves feliz. Cuéntame de esa noche.
Mamá: Era una fiesta en el barrio. Bailé hasta muy tarde.
Marina: ¿Y mi abuela te dejaba volver tan tarde?
Mamá: Esa noche sí. Era una fiesta muy especial.

Marina deja la caja en el suelo y se sienta al lado de su mamá.

Marina: ¿De verdad no me cuentas quién es ese muchacho de la foto?
Mamá: De ese muchacho te cuento otro día. Mañana volvemos a limpiar.`,

"por-fin-se-abre-la-puerta": `Desde temprano se oyen golpes y ruidos en el cuarto de Julián. Es domingo y Marina y su mamá no saben qué pasa.

Marina: ¿Qué hace Julián? Lleva toda la mañana con ese ruido.
Mamá: No sé. Cada vez que pregunto, cierra la puerta.
Marina: Qué raro. Nunca se levanta tan temprano un domingo.
Mamá: Déjalo tranquilo. Si necesita algo, ya nos llama.
Marina: Me muero de curiosidad. Voy a tocar la puerta.
Mamá: Espera un poco. Él nos va a contar a su tiempo.
Marina: ¿Y si le pasó algo ahí adentro?
Mamá: Tranquila. Es el ruido de quien trabaja en algo.

De pronto el ruido para. Julián sale del cuarto con las manos sucias y una sonrisa grande.

Julián: Mamá, ven un momento. Tengo algo para ti.
Mamá: ¿Para mí? ¿Y todo este misterio para qué era?
Julián: Cierra los ojos y dame la mano. No mires todavía.

Julián lleva a su mamá hasta el cuarto. En el centro hay una silla de madera, vieja pero como nueva.

Mamá: ¡Mi silla! La silla de tu abuela. Estaba rota hace años.
Julián: La arreglé. Cambié la madera y la pinté de nuevo.
Mamá: Hijo, no sé qué decir. Es el mejor regalo del mundo.

Mamá se sienta en la silla y la mece despacio. Marina abraza a su hermano, todavía sorprendida.

Marina: Con razón no nos dejabas entrar. Mira cómo te quedó la silla.
Julián: Valió la pena cada hora de trabajo. Ya quería ver tu cara.
Mamá: Es igualita a cuando era nueva. ¿Cómo aprendiste a hacer esto?
Julián: Vi muchos videos. Y pregunté en la tienda de madera.`,

"cafe-para-dos": `En un café del centro de Buenos Aires, Argentina, casi todas las mesas están ocupadas. Camila busca un lugar con su taza en la mano. Cerca de la ventana, un chico llamado Tomás está solo en una mesa para dos.

Camila: Hola, perdón. ¿Está libre esta silla?
Tomás: Sí, claro. Esta silla está libre.
Camila: Gracias. Hoy el café está muy lleno.
Tomás: Siempre los sábados. ¿Venís mucho por acá?

Camila: Es la primera vez. Trabajo cerca y quería probar el lugar.
Tomás: Buena idea. El café de acá es el mejor del barrio.
Camila: ¿Y qué pedís vos siempre? No sé qué probar.
Tomás: Pedí el café con leche. Lo hacen muy rico acá.
Camila: Qué bueno saberlo. Me llamo Camila, por cierto.
Tomás: Mucho gusto, Camila. Yo soy Tomás.

Los dos se saludan con la mano. Afuera, la calle brilla bajo el sol de la tarde.

Tomás: ¿Y en qué trabajás, Camila?
Camila: Soy maestra. Doy clases en una escuela acá cerca.
Tomás: Mirá qué bien. Yo trabajo en una librería, a dos cuadras.
Camila: Me encanta leer. Un día voy a conocerla.
Tomás: Vení cuando quieras. Siempre tengo algo nuevo para recomendar.

Camila prueba su café, que todavía está caliente, y siguen conversando un rato más.

Tomás: Bueno, ya sabés dónde encontrarme. La librería abre todos los días.
Camila: Me paso un día de estos, entonces. Gracias por la silla.`,

"quien-escribio-este-libro": `Camila empuja la puerta de la librería y suena una campana. El local abre temprano y, detrás del mostrador, Tomás la saluda con una sonrisa.

Camila: Hola, Tomás. Al final vine a conocer tu librería.
Tomás: ¡Camila! Qué bueno verte. Pasá y mirá con calma.
Camila: Busco un libro de cuentos para mis alumnos. Algo sencillo.
Tomás: Tengo justo lo que necesitás. Dame un segundo, ya lo bajo.

Tomás baja un libro de un estante alto y se lo da.

Tomás: Probá con este. Son cuentos cortos, muy fáciles de leer.
Camila: No sé... no conozco a este escritor. ¿Es bueno de verdad?
Tomás: Te lo recomiendo yo. A los chicos les va a encantar.
Camila: ¿Y de qué tratan los cuentos? Mis alumnos son chicos.
Tomás: De animales y de viajes. Cosas simples, nada difícil.
Camila: Bueno, me lo llevo. Si vos lo decís, le doy una oportunidad.

Camila abre el libro en la primera página. Adentro hay una foto de un hombre joven: es Tomás.

Camila: ¡Un momento! ¿Este libro lo escribiste vos?
Tomás: Sí... no te lo quería decir así. Es mi primer libro.
Camila: ¡No lo puedo creer! Vendés libros y además escribís.
Tomás: De día vendo, de noche escribo. Es mi sueño de siempre.
Camila: ¿Y por qué no lo contás a todos? Yo lo gritaría.
Tomás: Me da un poco de vergüenza. Prefiero que lean primero.

Camila mira a Tomás de otra manera. El vendedor tímido escribió el libro que ella tiene en las manos.

Camila: Ahora lo voy a leer con más ganas todavía.
Tomás: Avisame qué les parece. Su opinión me importa mucho.`,

"las-nueve-y-cinco": `Suena el teléfono en la librería y Tomás contesta. Es Camila, que llama desde su escuela con una idea entre manos.

Camila: Tomás, tengo un plan. ¿Tenés un minuto?
Tomás: Para vos siempre tengo tiempo. ¿De qué se trata?
Camila: ¿Querés venir el viernes? Podés leerles tu cuento a los chicos.
Tomás: ¿Yo? ¿Leer delante de toda una clase?

Tomás: Me da miedo, Camila. Nunca leí mi libro en voz alta.
Camila: Por eso mismo. Va a ser un día distinto para todos.
Tomás: ¿Y si lo hago mal? ¿Y si no les gusta nada?
Camila: Les va a encantar. Yo voy a estar a tu lado.
Tomás: ¿Cuántos chicos son? Me pongo nervioso con tanta gente.
Camila: Son veinte, y muy buenos. Te van a escuchar atentos.

Tomás se queda callado un momento. Mira los libros y respira hondo.

Tomás: Está bien. Lo voy a hacer. El viernes por la mañana.
Camila: ¡Qué bueno! Te espero a las nueve en la puerta.
Tomás: Ahí voy a estar, aunque ya estoy nervioso.

Llega el viernes. Camila espera afuera con sus alumnos y mira la calle una y otra vez. Son las nueve y cinco, y Tomás todavía no aparece.

Camila: Ya casi son las nueve y diez. ¿Le habrá pasado algo?

Uno de sus alumnos le tira de la manga y le pregunta si el señor va a venir o no.`,

"buscando-el-mar": `Diego mira un mapa en la esquina y no entiende nada. Está perdido en una zona nueva de Lima, Perú, y desde temprano busca el mar. Una vecina llamada Pilar lo nota y se acerca a ayudarlo.

Diego: Perdón, señora. ¿Sabe cómo llegar al mar?
Pilar: Claro, no estás lejos. Te explico el camino con calma.
Diego: Gracias. Llevo media hora dando vueltas con este mapa.
Diego: Soy nuevo en Lima. Todavía me pierdo en todos lados.
Pilar: Tranquilo, le pasa a todos al principio.

Pilar señala la avenida ancha con la mano.

Pilar: Es fácil. Camina derecho dos cuadras por esta avenida.
Pilar: Después cruzas la calle en el semáforo y doblas a la derecha.
Diego: ¿A la derecha en el semáforo? ¿Y ahí ya llego?
Pilar: Casi. Sigues un poco más y vas a ver un parque grande.
Diego: Un parque. ¿Y el mar está detrás del parque?
Pilar: Justo detrás. Lo vas a oír antes de verlo.

Pilar camina con él poco a poco hasta la entrada del parque. El aire huele distinto, más fresco que en la avenida.

Pilar: Mira hacia allá, donde está la gente.
Diego: Veo unas escaleras y una bajada larga.
Pilar: Da unos pasos más, hasta el borde. Vale la pena.

Diego camina hasta el borde del parque. De golpe todo se abre frente a él: el mar azul, justo abajo del malecón. La vista es enorme y el viento llega fresco a la cara.

Diego: ¡No lo puedo creer! Estaba a una cuadra y no lo sabía.
Pilar: Estaba aquí, detrás del parque. Baja a la arena y métete hasta la orilla.`,

"el-micro-junto-al-mar": `El micro hacia la costa está casi lleno cuando Pilar y Diego logran subir. El viaje cuesta poco y dura un buen rato. Don Beto, el señor que maneja, los saluda por el espejo.

Diego: ¡Justo a tiempo! Pensé que el micro ya se iba.
Pilar: Tranquilo, siempre entra uno más. Sube, hay dos asientos atrás.
Diego: Qué bueno. Vamos atrás, al lado de la ventanilla.
Pilar: Me gusta ese asiento. Se ve toda la calle desde ahí.

El micro avanza despacio por la avenida. Afuera, las casas del barrio brillan con colores fuertes.

Diego: Mira esa casa azul con flores. Qué bonito barrio.
Pilar: Esta parte de la ciudad es así. Cada calle tiene su color y su historia.
Diego: Nunca había venido por acá. Es más bonito de lo que pensaba.
Pilar: Espera a ver el mar. Queda cerquita de la plaza.
Diego: ¿Y este micro pasa seguido? Me quiero acordar del camino.
Pilar: Cada veinte minutos. Pronto te lo vas a saber de memoria.
Beto: Bajen en la próxima, muchachos. Ahí mismo queda la plaza.
Diego: Gracias, don Beto. ¿Cuánto es el pasaje?

Diego paga el pasaje y los dos bajan en la parada de la plaza. El mar se oye más o menos cerca, detrás de las casas de colores.

Pilar: Por aquí se baja a la playa. Llegamos sin correr y sin perdernos.
Diego: Entonces caminemos. Quiero terminar el paseo en la arena.`,

"una-fiesta-sin-aviso": `Pilar y Diego buscan la calle Unión por el centro. Doblan en una esquina y, sin aviso, no pueden avanzar: la plaza entera está llena de música y color.

Diego: ¿Y esto? Veníamos por una calle bien tranquila.
Pilar: Es una feria. Mira, hay puestos, globos y baile por todos lados.
Diego: Qué ruido tan alegre. ¿Sabes qué se celebra hoy?
Pilar: No tengo idea, pero la música está muy buena.
Diego: ¿Y el trámite? Teníamos que ir a la calle Unión.
Pilar: Está a media cuadra. No se va a ir a ningún lado.

En el centro de la plaza, sobre un escenario, un grupo toca tambores. La gente canta y baila en fila bajo el sol.

Diego: Mira cómo bailan todos. Hasta los más grandes se animan.
Pilar: Aquí siempre es así. Cualquier excusa es buena para una fiesta.
Carmen: ¡Acérquense! ¿Quieren un jugo de fruta bien frío?
Diego: Bueno, ya que estamos aquí. Dos jugos, por favor.
Carmen: Buena elección. La calle Unión puede esperar un rato.
Pilar: De acuerdo. El mandado lo hacemos después.

Pilar y Diego toman su jugo entre la gente que celebra. La calle que buscaban ya no les llama tanto.

Diego: Salimos por una dirección aburrida y encontramos una fiesta.
Pilar: Y eso que el mandado era para salir rápido.
Diego: Entonces nos quedamos. La calle Unión sigue mañana.`,
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
    const flags = [unknownSp.length ? `speaker fuera de spec: ${unknownSp}` : "", missing.length ? `vocab fuera: ${JSON.stringify(missing)}` : ""].filter(Boolean).join(" | ");
    await p.journeyStory.update({ where: { id: s.id }, data: { text: body, wordCount: wc(body) } });
    console.log(`${flags ? "⚠️ " : "ok"} ${slug}: ${wc(body)}w, ${ratio(body)}% diálogo${s.audioStatus === "ready" ? "  [AUDIO=ready → desincronizado]" : ""}${flags ? "  " + flags : ""}`);
  }
  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
