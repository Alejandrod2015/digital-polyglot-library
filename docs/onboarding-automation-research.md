# Onboarding y automatización de lifecycle: investigación + diseño para DPL

> Fecha: 2026-06-04. Fuente: dos pasadas de investigación profunda con verificación
> adversarial (deep-research harness). Foco: Duolingo, Babbel, Busuu, Memrise +
> apps de contenido (LingQ, Beelinguapp, Headway/Blinkist).
>
> **Cómo leer las afirmaciones:** cada hallazgo lleva `[confianza]` y, cuando aplica,
> el caveat de transferibilidad a DPL. DPL es vocabulario-en-contexto con historias
> y audio para adultos, freemium, NO drill-based; casi todos los benchmarks de hábito
> vienen del modelo drill-diario de Duolingo y transfieren con cuidado.

---

## 1. Resumen ejecutivo

1. **El "aha moment" de DPL debe ser "primera historia terminada", no minutos de audio ni primer item guardado.** Es el único hallazgo con evidencia directa de una app casi idéntica a DPL (LingQ) y coincide con el RCT que mide que el storytelling supera al drill en retención de vocabulario. `[alta]`
2. **Invierte el orden clásico: contenido antes de registro.** Deja leer/escuchar una historia de muestra SIN cuenta; pide signup en el momento lógico de "guardar tu progreso". Registro temprano = fricción que mata activación. `[alta direccional]`
3. **Primera historia corta a propósito.** LingQ partió su primera lección en 3 más cortas para garantizar el primer "finish"; el remate es lo que engancha. DPL debería tener una primera historia deliberadamente breve (o segmentada). `[media-alta]`
4. **DPL hoy no manda ni un solo email post-signup.** Ese es el gap más grande y el de mayor ROI inmediato. El welcome email es el activo de lifecycle de mayor apertura. `[alta]`
5. **Secuencia de email recomendada: front-load 5-7 emails en 7-14 días, welcome instantáneo, un solo CTA por email, disparada por comportamiento (no cron rígido).** `[alta]`
6. **El motor de hábito de DPL es el interés en el contenido, no la racha.** Las rachas funcionan en drills de 2 min; en long-form el predictor de fondo es "leí una historia que me importó y la entendí". Usa racha como leading indicator secundario, no como mecánica central. `[media, es la pregunta abierta]`
7. **Freemium puro convierte ~2-3%; trials 18-60%.** Cuando DPL monetice, soft paywall con trial > hard paywall; coloca el paywall POST-engagement (estilo Memrise), no a mitad del onboarding. `[alta]`

---

## 2. Hallazgos clave por tema

### 2.1 Activación / aha moment

- **LingQ (la app más cercana a DPL) define activación como "completar al menos una lección" antes del paywall, y ese evento predice conversión a pago** de forma estadísticamente significativa (caso LingQ + Amplitude). Su tier gratis permite guardar 20 palabras; quienes completaban una lección antes de la palabra 20 convertían mucho más. Respuesta de producto: partir la primera lección en 3 más cortas. `[alta; caveat: el artículo no da el % exacto de uplift]`
  - Fuente: https://amplitude.com/blog/lingq-cdp-increased-conversions
- **Marco PLG estándar:** activación = % de usuarios que llega al momento de valor; mide `activation rate` Y `time-to-activate`. Para Duolingo el evento es "primera lección completada". Para DPL: "primera historia terminada". Evita definir activación como "minutos de audio" o "primer item guardado" aislados (LingQ mostró que guardar palabras sin terminar lección NO es el predictor fuerte). `[alta]`
- **El predictor de retención de largo plazo en Duolingo es alcanzar racha de 7-10 días**, que optimizan como leading indicator en lugar de mirar D30. PERO el propio PM (Shuttleworth) admite que es correlación / survivorship, no causalidad. El dato "racha 7d = 3.6x completar curso" y "racha 7d = 2.4x volver al día siguiente" son reales pero son sesgo de selección. `[alta el número, baja la causalidad]`
  - Caveat DPL: la racha funciona en drills de 2 min; su transferibilidad a "una historia larga por día" es la pregunta abierta principal.

### 2.2 Patrones de flujo de onboarding

- **Patrón ganador: producto primero, registro diferido.** "El onboarding empieza con el producto y termina con creación de cuenta opcional" (Duolingo). Mover el signup a después de la primera lección subió la retención día-2 ~20% en Duolingo. `[alta el mecanismo; la magnitud 20% es Duolingo-específica]`
- **Encuesta breve de motivación + autosegmentación por nivel** ("¿por qué aprendes?") con test de nivel **opcional**. Babbel y Busuu hacen quiz de personalización; la diferencia es CUÁNDO piden cuenta.
- **Busuu es el anti-patrón:** signup completo + quiz multi-paso (~22 pasos) ANTES de la primera lección = fricción y drop-off documentado. `[media, single-source screensdesign]`
- **Permiso de notificaciones:** pedirlo DESPUÉS de las preguntas de compromiso (priming), nunca en frío al abrir. `[media; fuentes discrepan sobre el orden exacto en Babbel]`
- **Nivelación como nudge post-registro, no como muro:** Babbel pone el placement quiz en el dashboard ya logueado, opcional. Busuu usa test adaptativo CAT/IRT de ~5 min. Para DPL, la nivelación no debe bloquear la primera historia.

### 2.3 Email / lifecycle automation

- **Estructura recomendada: front-load 5-7 emails en los primeros 7-14 días** ("sweet spot"; más cortas no activan, más largas pierden momentum). Welcome **instantáneo** (no batch). `[alta]`
  - Fuentes: sequenzy.com, encharge.io, smashsend.com
- **Welcome email = mayor open rate de toda la secuencia (~40-80% según fuente; ~4x el resto).** Los emails automatizados/triggered generan ~30% del revenue de email desde ~2% de los envíos. `[alta; la cifra 60-80% es la optimista, encharge da 40-60%]`
- **Disparadores conductuales > tiempo rígido**, pero con matiz: el famoso "70.5% más open" mide *triggered vs batch-newsletter*, NO *behavioral-trigger vs time-trigger*; no lo cites como prueba de lo segundo. Lo correcto: esqueleto time-based + ramas conductuales (ej. "completó 1ª historia" -> celebración; "no abrió en 48h" -> nudge). `[tesis alta, número desacreditado]`
- **Benchmarks email educación (ActiveCampaign 2025):** ~39% open / ~6.4% click / ~16% click-to-open. **Caveat crítico:** Apple Mail Privacy Protection infla los opens; prioriza click-through y conversión sobre opens crudos. La métrica que importa en edtech es activation rate, no open. `[alta]`
- **Copy que funciona:** (1) loss aversion / recordar lo invertido ("estás a una historia de mantener tu progreso"), sin amenaza; (2) progress recap semanal celebrando small wins; (3) win-back humano ("te extrañamos") + pequeño incentivo, no tono desesperado. **Un solo CTA por email.** `[media-alta; convención de copy, no hallazgo cuantitativo]`
- **Win-back:** reengancha dentro de los primeros 3-4 días de inactividad (Duolingo apaga su recordatorio principal a los 7 días porque la efectividad cae). Para campañas largas: secuencia escalada de 3-5 emails espaciados 7-14 días con sunset final; inactivos a 90 días reactivan ~10-12%, a 180 días solo 2-4%. `[alta]`
- **Single vs double opt-in:** para edtech monetizado, single opt-in (no friccionar activación) + verificación de email + sunset agresivo para proteger deliverability. ~90% de negocios usan single. `[alta]`

### 2.4 Conversión freemium -> pago

- **Freemium puro: ~2-3% (mediana ~4.5%). Trials: 18-60%** según opt-in/opt-out. Trials largos (17-32 días) convierten 45.7% vs 26.8% de trials de 3-7 días. `[alta los rangos; los puntos exactos varían por año/fuente]`
- **Multi-ask contextual (Duolingo):** 7+ touchpoints de upgrade en una sesión, cambiando el primer bullet del paywall según dónde entró el usuario; NO spam ("donde tenga sentido"). `[alta]`
- **Exit-intent multicapa (Babbel):** cada vez que cierras la oferta, recibes una más blanda (trial -> hasta 55% off). `[alta, single-source pero cita verbatim]`
- **Paywall POST-engagement (Memrise):** el upgrade aparece después de lecciones iniciales, no en el onboarding crítico; intercala "onboarding tasks" entre lecciones para mantener momentum. `[media]`
- **Web2app (Babbel):** convierten en web y luego mandan a instalar la app, evitando la comisión 30% de Apple (estimado ~$900k/mes a su escala). Patrón dominante 2026 en apps de suscripción adultas. `[alta el mecanismo; cifras son estimación de terceros]`

### 2.5 Retención y ciencia conductual

- **Loss aversion** (perder duele ~2x ganar, Kahneman-Tversky): el motor declarado del streak de Duolingo.
- **Identidad/meta > badges:** Blinkist muestra "cuántos libros te faltan para tu yo deseado" (progreso hacia identidad), sube tiempo de sesión.
- **Micro-sesiones:** Headway parte cada resumen en trozos bite-sized para múltiples remates a lo largo del día. Aplica directo a DPL: parte historias largas en segmentos cortos, cada uno con su micro-aha, conservando la sensación de logro sin exigir terminar algo largo de una sentada. `[media; Headway/Blinkist son L1 no-ficción, su personalización transfiere mejor que su gamificación]`

### 2.6 El diferenciador de DPL (contenido vs drill)

- **RCT peer-reviewed (Computers and Education: AI, Elsevier 2025, n=90, 4 semanas, 3 grupos):** el grupo de storytelling con IA superó al grupo gamificado (ejercicios reales de Duolingo) Y al control en retención de vocabulario inmediata Y diferida, con MAYOR engagement reportado. El grupo gamificado lo encontró "entretenido pero menos profundo". `[alta para un solo RCT; no es consenso de campo, n~30/grupo, EFL]`
  - Fuente: https://www.sciencedirect.com/science/article/pii/S2666920X25001456
- **Hábito de lectura formado:** 12 semanas después de un concurso de lectura, el grupo tratado seguía con engagement 75% más alto que el control. `[media, contexto escolar]`
- **Conclusión:** en long-form el motor es el interés intrínseco; la recompensa es terminar una historia que te importa y entenderla. La racha no reemplaza eso.

---

## 3. Teardown comparativo

| Dimensión | Duolingo | Babbel | Busuu | Memrise |
|---|---|---|---|---|
| Orden registro | Producto primero, cuenta opcional al final | Quiz -> signup -> paywall (signup antes de lección, disputado) | **Signup + quiz ANTES de 1ª lección (anti-patrón)** | Signup temprano tras preferencias, antes de core |
| Onboarding | Corto, lección en ~60s | Largo (17 pasos / 20+ web2app), personalización-first | Largo (~22 pasos) | Experiencial, "onboarding tasks" entre lecciones |
| Nivelación | Placement test opcional | Opcional, post-registro en dashboard | Adaptativo CAT/IRT ~5 min | Autoevaluación en onboarding |
| Paywall | Multi-ask contextual, free tier fuerte | Soft, tras signup, exit-intent hasta 55% off | Soft, temprano, trial 7d -> anual | **Post-engagement** (tras lecciones iniciales) |
| Activación | 1ª lección completada | 1ª lección corta interactiva | 1ª lección abre con video de nativo | Clips de video de nativos ("Learn with Locals") |
| Primer valor | XP + racha | Lección interactiva | Inmersión con hablante real | Inmersión con hablante real |

**Lectura para DPL:** copia de Memrise el paywall post-engagement; de Babbel la personalización-first y el web2app; de Busuu **NO** copies el signup-antes-de-lección; de Duolingo el producto-primero y el multi-ask contextual. El valor de primera sesión de Busuu/Memrise (video de nativo) es el equivalente de tu audio + historia.

---

## 4. Benchmarks numéricos (sector idiomas/edtech)

| Métrica | Valor | Confianza / caveat |
|---|---|---|
| Retención D1 educación (buena) | 35-40% ("gold") | alta |
| Retención D7 iOS (cross-cat) | ~6.9% | media |
| Retención D30 educación | **~2-3% (de las peores categorías)** | alta; promedio incluye apps malas, no es piso para nicho de calidad |
| Open rate email educación | ~28-39% | alta; inflado por Apple MPP |
| Click rate email educación | ~3-6% | media; depende de plataforma |
| Welcome email open | ~40-80% | alta; el más alto de la secuencia |
| Freemium -> pago | ~2-3% (mediana 4.5%) | alta |
| Trial -> pago | 18-60% (opt-in ~8-22%, opt-out ~35-55%) | alta los rangos |
| Trial largo (17-32d) vs corto (3-7d) | 45.7% vs 26.8% | media |
| Reactivación win-back a 90d / 180d | 10-12% / 2-4% | alta |

> **NO usar (refutados en verificación):** racha-animación +1.7% D7; Duolingo capea push a 2/día; conversión Duolingo 5.1% con target 10%; cifras opt-in 18.2% / opt-out 48.8% como puntos fijos. Babbel: los precios exactos $14.99/$9.99/$7.99 (las fuentes dan $17.95/$13.45/$8.95 de lista); "+14% a día 14" (es día 7, Streak Wager).

---

## 5. Diseño de onboarding para DPL

### 5.1 Estado actual (lo que ya existe)

- Webhook `user.created` registra `signup_completed` en `UserMetric` (`src/app/api/webhooks/clerk/route.ts:84`). **No manda email.**
- Redirect post-login a `/auth/post-login` -> evento GA4 `sign_up` -> home.
- En home: encuesta de onboarding + tour de 5 pasos + abre historia gratis con coachmark (`src/app/HomeClient.tsx:435`). **Todo esto ocurre DESPUÉS del login.**
- Resend configurado (`src/lib/email.ts`) pero solo para beta-confirmation y claim de libros.

### 5.2 Gaps vs la investigación

1. La primera historia se abre **después** del signup, no antes. La literatura dice: deja consumir antes de pedir cuenta.
2. No hay un evento de activación instrumentado tipo "primera historia terminada" como north-star.
3. Cero automatización de email post-signup.
4. La encuesta va después del login (fricción en el momento equivocado); debería ser parte del flujo de descubrimiento, no un gate post-cuenta.

### 5.3 Flujo objetivo (en orden)

1. **Landing -> abrir una historia de muestra SIN cuenta** (corta, con audio). Cumple "producto primero". El conversion-goal único de la landing se mantiene (sin links secundarios, ver memoria).
2. **Encuesta breve de personalización** (idioma/nivel/interés) integrada en la experiencia, no como muro. 3 opciones simples por pregunta (Beginner/Intermediate/Advanced), no taxonomías.
3. **Al terminar la primera historia** (= aha moment) -> prompt "guarda tu progreso" -> signup. Registro diferido al momento de valor.
4. **Post-signup:** nivelación como nudge opcional (no muro) + tour ligero. Permiso de notificaciones con priming, después del compromiso.
5. **Paywall (cuando exista premium):** post-engagement, soft, con trial. Nunca a mitad del onboarding crítico.

**North-star a instrumentar:** `story_completed` (primera historia). Mide `activation_rate` y `time-to-activate`. La primera historia debe ser corta o segmentada para garantizar el primer remate (lección de LingQ).

---

## 6. Diseño de automatización email / lifecycle

> Stack: enganchar al webhook `user.created` (ya existe) + Resend (`src/lib/email.ts`).
> Disparo por evento donde se pueda; esqueleto temporal + ramas conductuales.
> Single opt-in. Un solo CTA por email. Todo el copy del usuario final en el idioma
> de la UI (la app mobile va en inglés; web según corresponda).

### 6.1 Secuencia base (front-loaded, 5-6 emails / primeros 10-14 días)

| # | Disparo | Email | CTA único |
|---|---|---|---|
| 0 | `user.created` (instantáneo) | **Welcome:** qué es DPL + invita a terminar tu primera historia | "Abre tu primera historia" |
| 1 | +24h si NO completó 1ª historia | **Nudge de activación:** "tu primera historia te espera, son X minutos" | "Termínala ahora" |
| 1b | Al completar 1ª historia (conductual) | **Celebración:** primer logro + sugiere la siguiente | "Sigue con la próxima" |
| 2 | Día 3 | **Educativo:** cómo funciona el vocabulario-en-contexto / tip de uso | "Practica el vocabulario" |
| 3 | Día 7 | **Progress recap:** historias leídas + vocab + (racha si aplica), loss aversion suave | "Mantén el ritmo" |
| 4 | Día 10-14 | **Hábito / siguiente meta:** progreso hacia identidad ("vas por X de tu meta") | "Elige tu próxima historia" |

### 6.2 Ramas conductuales (sobre el esqueleto)

- **No abrió en 48h** -> nudge de re-activación (dentro de la ventana de los 3-4 días, que es cuando funciona).
- **Completó historia** -> celebración + siguiente (corta la secuencia genérica de ese día).
- **Inactivo 30-45 días** -> win-back escalado de 3 emails (recordatorio suave -> valor/historia nueva -> incentivo), espaciados 7-14 días, con sunset final. Tono humano, no desesperado.

### 6.3 Reglas de copy

- Loss aversion sobre lo ya invertido ("estás a una historia de mantener tu progreso"), sin amenaza.
- Progress recap que celebra small wins (historias completadas, palabras nuevas).
- Un solo CTA por email, orientado al beneficio.
- Sin em-dashes (regla del proyecto). Tono cálido, no telegráfico.

---

## 7. Plan de implementación por fases

**Fase 1 (gap de mayor ROI): welcome email.**
- En `src/app/api/webhooks/clerk/route.ts`, dentro de `isUserCreatedEvent`, tras registrar el `UserMetric`, llamar a un nuevo `sendWelcomeEmail({ email })` en `src/lib/email.ts` (mismo patrón que `sendBetaConfirmationEmail`). Instantáneo, single opt-in.
- Riesgo: el webhook ya es el path crítico de signup; envolver el envío en try/catch para que un fallo de Resend nunca rompa el tracking.

**Fase 2: instrumentar activación.**
- Emitir `UserMetric` con `eventType: "story_completed"` (o reusar el existente si ya se trackea) y exponer `activation_rate` + `time-to-activate` en `/studio/metrics`.

**Fase 3: secuencia lifecycle.**
- Decidir motor: Resend con scheduling propio (cron en `vercel.json` que consulta UserMetric y dispara) vs herramienta de lifecycle (Customer.io / Loops) conectada a eventos. Para empezar simple: cron diario que evalúa el estado de cada usuario nuevo y manda el email que toque. Gating por evento, no solo por día.

**Fase 4: reordenar el onboarding** (producto antes de signup). Es el cambio más grande de producto; requiere permitir abrir una historia de muestra sin cuenta y mover el prompt de registro al "guardar progreso". Validar con datos propios antes de asumir el +20% de Duolingo.

**Fase 5 (cuando haya premium): paywall post-engagement** con trial, multi-ask contextual, exit-intent suave.

---

## 8. Caveats y preguntas abiertas

- **Causalidad vs correlación:** el dato estrella de racha (3.6x / 2.4x) es survivorship admitido, no causalidad. Direccional, nunca garantía.
- **Transferibilidad:** los benchmarks de hábito vienen del drill-diario de Duolingo; "una historia por día" no es conductualmente equivalente a "una lección de 2 min". El único dato directamente pro-DPL (historias > gamificado) es un solo RCT (n=90).
- **El aha de un producto de contenido no está canónicamente definido por la industria;** LingQ es la mejor analogía, pero DPL debe validar su propio aha con su curva de retención por feature, no asumir el de LingQ.
- **Email específico:** casi toda la evidencia de timing es push in-app de Duolingo; los benchmarks de open/click de email son genéricos de edtech, no de apps de idiomas concretas. Validar con tus propios envíos.
- **Numéricos puntuales** (precios Babbel, % exactos) son snapshots; usa rangos, no puntos.

---

## Fuentes principales

- LingQ + Amplitude (activación contenido): https://amplitude.com/blog/lingq-cdp-increased-conversions
- RCT storytelling vs gamificado (Elsevier 2025): https://www.sciencedirect.com/science/article/pii/S2666920X25001456
- Duolingo streak / hábito: https://blog.duolingo.com/how-duolingo-streak-builds-habit/
- Duolingo reactivación (Shuttleworth/Sub Club): https://subclub.com/episode/how-to-time-reactivation-campaigns-for-maximum-impact-jackson-shuttleworth-duolingo
- Duolingo growth (Lenny's/Mazal): https://www.lennysnewsletter.com/p/how-duolingo-reignited-user-growth
- Babbel teardown: https://screensdesign.com/showcase/babbel-language-learning
- Babbel web2app + exit funnel: https://thegrowthhackinglab.com/case-studies/how-babbel-hits-3m-monthly-revenue-the-paid-ads-and-conversion-machine-behind-a-language-app/
- Busuu teardown: https://screensdesign.com/showcase/busuu-language-learning
- Email benchmarks: https://www.activecampaign.com/blog/activecampaign-email-benchmarks
- Onboarding email sequence: https://www.sequenzy.com/blog/how-to-create-saas-onboarding-email-sequence
- Trial conversion benchmarks: https://adapty.io/blog/trial-conversion-rates-for-in-app-subscriptions/
- Education app benchmarks: https://www.businessofapps.com/data/education-app-benchmarks/
