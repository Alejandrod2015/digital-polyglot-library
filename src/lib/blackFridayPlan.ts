// ────────────────────────────────────────────────────────────────────
// Black Friday 2026 campaign plan; single source of truth for the
// /studio/black-friday planning surface.
//
// This mirrors the research synthesis (7-angle deep research, 100+
// sources, adversarial verification) into an editable, trackable plan.
// Edit statuses/owners here as the campaign progresses; the Studio page
// renders straight from this module.
//
// Goal: maximize NEW PAID SUBSCRIBERS · Market: US · Event: Nov 27 2026.
// ────────────────────────────────────────────────────────────────────

export type TaskStatus = "todo" | "in_progress" | "done" | "blocked";

export const TASK_STATUS_META: Record<
  TaskStatus,
  { label: string; fg: string; bg: string }
> = {
  todo: { label: "Pendiente", fg: "#94a3b8", bg: "rgba(148,163,184,0.14)" },
  in_progress: { label: "En curso", fg: "#fcd34d", bg: "rgba(252,211,77,0.16)" },
  done: { label: "Hecho", fg: "#34d399", bg: "rgba(52,211,153,0.16)" },
  blocked: { label: "Bloqueado", fg: "#f87171", bg: "rgba(248,113,113,0.16)" },
};

export type Decision = { title: string; body: string };
export type BuildTask = {
  title: string;
  note: string;
  status: TaskStatus;
  priority: number; // 1 = highest
};
export type CalendarPhase = {
  date: string;
  phase: string;
  detail: string;
  peak?: boolean;
};
export type Channel = { rank: number; name: string; note: string };
export type Risk = { label: string; body: string; kind: "risk" | "ok" };

export type BlackFridayPlan = {
  lastUpdated: string;
  eventDate: string;
  pdfHref: string;
  goal: string;
  market: string;
  offer: {
    headline: string;
    priceStrike: string;
    priceNow: string;
    bullets: string[];
  };
  decisions: Decision[];
  buildTasks: BuildTask[];
  calendar: CalendarPhase[];
  channels: Channel[];
  pageTactics: string[];
  retention: string[];
  risks: Risk[];
  confidenceNote: string;
  sourcesCount: number;
};

export const BLACK_FRIDAY_PLAN: BlackFridayPlan = {
  lastUpdated: "2026-06-04",
  eventDate: "Vie 27 nov – Lun 30 nov 2026 (Cyber Monday)",
  pdfHref: "/black-friday/onepager.pdf",
  goal: "Maximizar nuevos suscriptores pagos",
  market: "US · freemium + trial 14d + Stripe web",

  offer: {
    headline: "50% off año 1 del plan anual",
    priceStrike: "$149",
    priceNow: "$74.50",
    bullets: [
      "Anual solamente · solo primer período · renueva a $149. Sin lifetime.",
      "Mensual ($15) sin descuento: ancla el anual a ~$6.20/mes efectivo.",
      "Trial de 14d con tarjeta ADELANTE de la oferta; cupón Stripe duration:once en la 1ª factura post-trial.",
      "La renovación a los 12 meses (nov 2027) cobra $149 completos.",
    ],
  },

  decisions: [
    {
      title: "% off anual protege el LTV",
      body:
        "El anual retiene ~2.5x mejor que el mensual a 12 meses (RevenueCat). Difiere el acantilado de churn 12 meses. Evita la destrucción de LTV de $1/mes y de lifetime.",
    },
    {
      title: "El pico es la noche de Cyber Monday",
      body:
        "Lun 30 nov, 8–10 PM ET; no el viernes. CM 2025 marcó récord de $14.25B vs $11.8B del Black Friday. Concentrar el último push ahí.",
    },
    {
      title: "Ganar en canales propios, no en paid",
      body:
        "Los CPMs de Meta/Google se inflan 12–43% en Cyber Week; el remarketing convierte +58%. Construir lista barata en sep–oct y convertirla en la semana de BF.",
    },
    {
      title: "No alargar el trial",
      body:
        "14 días ya es el sweet spot. El trial con tarjeta convierte ~48.8% trial→paid vs ~2.6% freemium. Alargarlo a 30d sube cancelaciones a 51%.",
    },
    {
      title: "Arco multi-día, no un blast de un día",
      body:
        "Teaser → early access → Black Friday → Cyber Monday → extensión. Ventana total ~14 días, dentro de la norma verificada de 10–34 días.",
    },
    {
      title: "Nada de lifetime (por ahora)",
      body:
        "DPL paga costo de audio IA por uso; el lifetime solo funciona con costo marginal ≈ 0. Mataría el revenue recurrente. Guardarlo como jugada futura de caja.",
    },
  ],

  buildTasks: [
    {
      priority: 1,
      status: "todo",
      title: "Mecanismo de cupón (no existe hoy)",
      note:
        "Cupón Stripe 50% off anual, duration:once, adjunto al trial-start para que la 1ª factura post-trial salga descontada. Auto-aplicado por flag de campaña; sin campo público de código. (Campo colapsable solo si se corren códigos de influencer.)",
    },
    {
      priority: 2,
      status: "todo",
      title: "Parametrizar precios (hoy hardcodeados)",
      note:
        "Mover $149 / $15 / $74.50 de plans/page.tsx a config server-driven, on/off por fecha. Alimenta el strike-through y el countdown real.",
    },
    {
      priority: 3,
      status: "todo",
      title: "Apretar el free tier (hoy ilimitado)",
      note:
        "readingLimits devuelve Infinity. Definir y enforce los gates premium (librería completa, audio completo, offline) en el call-site. Sin esto, el descuento no tiene qué vender.",
    },
    {
      priority: 4,
      status: "todo",
      title: "CRO de checkout",
      note:
        "Stripe Express Checkout Element con Apple Pay arriba, mínimos campos, sin cuenta obligatoria, y handoff 'termina en desktop / te mando el link' para Safari mobile.",
    },
    {
      priority: 5,
      status: "todo",
      title: "Analytics de cohortes + lifecycle",
      note:
        "Tag de subs por fuente/campaña; dashboards 30/60/90d de retención; secuencia pre-renovación + save-flow (pausa/downgrade) + win-back atados a eventos Stripe.",
    },
  ],

  calendar: [
    { date: "Jun–Jul", phase: "Prep", detail: "Build promo + parametrizar precios + apretar free tier" },
    { date: "Ago", phase: "Prep", detail: "Oferta + creatividad; QA del cupón Stripe end-to-end; analytics de cohortes" },
    { date: "Sep–Oct", phase: "Paid", detail: "Construir lista (email/SMS) barata; calentar pixel; reclutar micro-influencers" },
    { date: "10–16 nov", phase: "Teaser", detail: "Waitlist 'avísame' + banner in-app" },
    { date: "23–25 nov", phase: "Early access", detail: "Acceso solo-lista; desahoga la carga" },
    { date: "27–30 nov", phase: "EVENTO", detail: "Email + SMS a volumen · peak CM lun 8–10 PM ET", peak: true },
    { date: "1–6 dic", phase: "Extensión", detail: "'Extendido por demanda'; last chance final 24–48h a no-convertidos" },
  ],

  channels: [
    { rank: 1, name: "Email", note: "Canal primario. Email+SMS = 43% del GMV de BF (Klaviyo)." },
    { rank: 2, name: "SMS", note: "En evento + last chance (momentos de máxima intención)." },
    { rank: 3, name: "Push", note: "Dosificado: evitar fatiga y opt-outs durante BFCM." },
    { rank: 4, name: "TikTok / Google Search", note: "TikTok top-funnel barato; Google Search alta intención." },
    { rank: 5, name: "Retargeting", note: "En BF; NO prospecting frío a CPM pico." },
    { rank: 6, name: "ASA / Referral", note: "Medir CAC install→trial-start (no costo de install); sembrar referral en early access." },
  ],

  pageTactics: [
    "Auto-aplicar el descuento; sin campo de promo (lo muestra el 35% de sites y fuga usuarios a buscar códigos).",
    "Ancla de precio: $149 tachado → $74.50, 'Ahorra $74.50 (50%)'.",
    "Apple Pay visible arriba (≈ +22% conversión); la mayoría del tráfico es mobile.",
    "Countdown REAL server-side que deshabilita la oferta al expirar (un timer falso es dark pattern / riesgo FTC).",
    "Testimonios específicos junto al paywall (+34% en el caso WikiJob de VWO); idealmente un video corto.",
    "Ruta 'termina en desktop' para Safari mobile (desktop convierte ~7.0% vs ~4.6% mobile en CM).",
  ],

  retention: [
    "El lock anual ES la retención principal: difiere el acantilado a nov 2027.",
    "Secuencia pre-renovación 30–45 días antes (oct 2027): recap de valor + precio $149 claro y temprano (evita price-shock).",
    "Save-flow de cancelación: ofrecer pausa + downgrade a mensual antes de cancelar (los save-flows reducen churn hasta ~39%).",
    "Win-back 30–60 días post-cancel (recupera ~15–30%).",
    "Trackear churn por fuente de adquisición a 30/60/90 días: los usuarios BF traen peor engagement.",
  ],

  risks: [
    {
      kind: "risk",
      label: "iOS → web checkout",
      body:
        "El 9º Circuito (dic 2025) permite a Apple cobrar una comisión 'razonable' por links externos (% aún sin fijar). Modelar margen asumiendo comisión; tratar el linkout como US-only; monitorear el remand + Corte Suprema.",
    },
    {
      kind: "risk",
      label: "Anti-steering",
      body:
        "El botón/link a web checkout no puede ser más prominente que el IAP. No vestirlo como un CTA más fuerte que ningún elemento de IAP en la app.",
    },
    {
      kind: "risk",
      label: "Chargebacks ene–feb",
      body:
        "La 'avalancha de enero' (friendly fraud >45% de disputas). Mitigar con billing descriptor claro, precio de renovación visible, cancel path visible y recordatorios pre-renovación.",
    },
    {
      kind: "risk",
      label: "Discount-training",
      body:
        "No correr una venta de Año Nuevo seguida que señale que los descuentos son rutina. Los descontadores agresivos muestran ~32% menos LTV.",
    },
    {
      kind: "ok",
      label: "Cupón duration:once",
      body:
        "Usar duration:once (no 'repeating', que podría agarrar la renovación por accidente). Así la renovación cobra $149 completos.",
    },
  ],

  confidenceNote:
    "Cifras con pase de verificación adversarial; varias son direccionales / datos de vendor (strike-through, video, Recurly 2016-17). El % exacto de comisión Apple post-remand aún no está fijado judicialmente.",
  sourcesCount: 100,
};
