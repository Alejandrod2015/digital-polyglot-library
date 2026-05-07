// shared.jsx — design tokens, icons, chrome shared across all variants

// ═══════════════════════════════════════════════════════════════════
// DESIGN TOKENS
// ═══════════════════════════════════════════════════════════════════
const TOKENS = {
  // backgrounds — matches real Journey: radial(lime) + gradient(#0a2b56→#08264d→#071f43)
  bg0:      '#051834',   // deepest (matches #071f43 darkened)
  bg1:      '#08264d',   // app bg (from real Journey)
  bg2:      '#0a2b56',   // cards / hero
  bg3:      '#13315E',   // raised (rgba(19,50,83,0.84))
  bg4:      '#1d437A',   // selected / pill bg
  // ink
  ink0:     '#FFFFFF',
  ink1:     'rgba(255,255,255,0.86)',  // white/86
  ink2:     'rgba(255,255,255,0.60)',  // white/60
  ink3:     'rgba(255,255,255,0.38)',  // white/38
  // brand / accents — real Journey uses lime + sky gradient
  lime:     '#BEF264',   // lime-300 (primary brand)
  limeDeep: '#84CC16',
  limeSoft: 'rgba(190,242,100,0.15)',
  sky:      '#7DD3FC',   // sky-300
  skyDeep:  '#38BDF8',   // sky-400 (gradient end)
  cyan:     '#7DD3FC',   // alias to sky for compat
  cyanDeep: '#38BDF8',
  cyanSoft: 'rgba(125,211,252,0.15)',
  // topic node gradient colors (from real topicVisuals)
  amber:    '#FCD34D',
  rose:     '#FDA4AF',
  fuchsia:  '#F0ABFC',
  emerald:  '#6EE7B7',
  violet:   '#C4B5FD',
  // semantic
  xp:       '#BEF264',   // use lime for XP
  streak:   '#FB923C',   // warm orange (amber-400ish)
  streakHot:'#F97316',
  gems:     '#C4B5FD',   // violet
  gold:     '#FCD34D',   // amber-300
  energy:   '#F0ABFC',   // fuchsia-300
  // misc
  line:     'rgba(255,255,255,0.10)',  // white/10
  dash:     'rgba(255,255,255,0.20)',
};

// ═══════════════════════════════════════════════════════════════════
// STATUS BAR (iOS-ish, dark)
// ═══════════════════════════════════════════════════════════════════
function StatusBar({ time = '14:23' }) {
  return (
    <div className="status-bar">
      <div>{time}</div>
      <div className="status-right">
        {/* signal dots */}
        <svg width="18" height="11" viewBox="0 0 18 11"><g fill="rgba(255,255,255,0.4)">
          <circle cx="2" cy="8" r="1.4"/><circle cx="6.5" cy="8" r="1.4"/><circle cx="11" cy="8" r="1.4"/><circle cx="15.5" cy="8" r="1.4"/>
        </g></svg>
        {/* wifi */}
        <svg width="17" height="12" viewBox="0 0 17 12" style={{ marginLeft: 4 }}>
          <path fill="#fff" d="M8.5 3C10.8 3 12.9 3.9 14.4 5.4L15.5 4.3C13.7 2.5 11.2 1.3 8.5 1.3C5.8 1.3 3.3 2.5 1.5 4.3L2.6 5.4C4.1 3.9 6.2 3 8.5 3Z"/>
          <path fill="#fff" d="M8.5 6.5C9.9 6.5 11.1 7 12 7.9L13.1 6.8C11.8 5.6 10.2 4.8 8.5 4.8C6.8 4.8 5.2 5.6 3.9 6.8L5 7.9C5.9 7 7.1 6.5 8.5 6.5Z"/>
          <circle cx="8.5" cy="10" r="1.4" fill="#fff"/>
        </svg>
        {/* battery green */}
        <svg width="27" height="12" viewBox="0 0 27 12" style={{ marginLeft: 4 }}>
          <rect x="0.5" y="0.5" width="22" height="11" rx="3" fill="none" stroke="rgba(255,255,255,0.5)"/>
          <rect x="2" y="2" width="17" height="8" rx="1.5" fill="#3ED17A"/>
          <path d="M24.5 3.5v5c.9-.3 1.5-1 1.5-2.5s-.6-2.2-1.5-2.5Z" fill="rgba(255,255,255,0.5)"/>
          {/* bolt */}
          <path d="M11 1.7l-4 5h3l-1 3.5 4-5h-3l1-3.5Z" fill="#0B1530"/>
        </svg>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ICONS (24×24 stroke) — used in tab bar + scattered
// ═══════════════════════════════════════════════════════════════════
const Icon = {
  Home: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg>,
  Compass: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="9"/><path d="M16 8l-2 6-6 2 2-6 6-2z"/></svg>,
  Dumbbell: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M6 6v12M9 4v16M15 4v16M18 6v12M3 10v4M21 10v4M9 12h6"/></svg>,
  Star: (p) => <svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M12 2l3 6.5 7 .8-5.2 4.7 1.5 7L12 17.5 5.7 21l1.5-7L2 9.3l7-.8L12 2z"/></svg>,
  StarOutline: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" {...p}><path d="M12 3l2.9 6.2 6.6.8-4.9 4.5 1.4 6.6L12 17.8 6 21.1l1.4-6.6L2.5 10l6.6-.8L12 3z"/></svg>,
  Trail: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M6 17c0-6 12-4 12-10"/></svg>,
  Menu: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" {...p}><path d="M4 7h16M4 12h16M4 17h16"/></svg>,
  Chevron: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M9 6l6 6-6 6"/></svg>,
  ChevronDown: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M6 9l6 6 6-6"/></svg>,
  Flame: (p) => <svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M12 2c1 4 5 5 5 10a5 5 0 01-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z"/></svg>,
  Bolt: (p) => <svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z"/></svg>,
  Gem: (p) => <svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M6 3h12l3 5-9 13L3 8l3-5z" opacity="0.9"/><path d="M9 8l3 13 3-13-3-5-3 5z" fill="rgba(255,255,255,0.25)"/></svg>,
  Book: (p) => <svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M5 4h11a3 3 0 013 3v14H8a3 3 0 01-3-3V4z" opacity="0.95"/><path d="M5 4v14a3 3 0 013-3h11V7a3 3 0 00-3-3H5z" fill="rgba(0,0,0,0.15)"/></svg>,
  Video: (p) => <svg viewBox="0 0 24 24" fill="currentColor" {...p}><rect x="2" y="6" width="14" height="12" rx="2.5"/><path d="M16 11l6-3v8l-6-3v-2z"/></svg>,
  Headphones: (p) => <svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M12 3a9 9 0 00-9 9v5a3 3 0 003 3h2v-8H5v0a7 7 0 1114 0v0h-3v8h2a3 3 0 003-3v-5a9 9 0 00-9-9z"/></svg>,
  Lock: (p) => <svg viewBox="0 0 24 24" fill="currentColor" {...p}><rect x="4" y="10" width="16" height="11" rx="2.5"/><path d="M8 10V7a4 4 0 018 0v3" fill="none" stroke="currentColor" strokeWidth="2"/></svg>,
  Heart: (p) => <svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M12 21s-8-5-8-11a5 5 0 019-3 5 5 0 019 3c0 6-10 11-10 11z"/></svg>,
  Trophy: (p) => <svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M6 4h12v5a6 6 0 01-12 0V4z"/><path d="M3 5h3v3a3 3 0 01-3-3zM21 5h-3v3a3 3 0 003-3zM9 15h6v2H9zM8 19h8v2H8z"/></svg>,
  Check: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M5 12l5 5L20 7"/></svg>,
  Plus: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" {...p}><path d="M12 5v14M5 12h14"/></svg>,
  Play: (p) => <svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M7 4l14 8-14 8V4z"/></svg>,
  Sparkle: (p) => <svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M12 2l2 8 8 2-8 2-2 8-2-8-8-2 8-2 2-8z"/></svg>,
};

// ═══════════════════════════════════════════════════════════════════
// FLAG — Germany (subtle, with a small accent dot)
// ═══════════════════════════════════════════════════════════════════
function GermanFlag({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28">
      <defs>
        <clipPath id="ff"><circle cx="14" cy="14" r="14"/></clipPath>
      </defs>
      <g clipPath="url(#ff)">
        <rect x="0" y="0" width="28" height="9.33" fill="#1a1a1a"/>
        <rect x="0" y="9.33" width="28" height="9.34" fill="#D93841"/>
        <rect x="0" y="18.67" width="28" height="9.33" fill="#F2C200"/>
      </g>
      <circle cx="14" cy="14" r="13.5" fill="none" stroke="rgba(255,255,255,0.15)"/>
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════
// STAT CHIP — small pill with icon + number (used in compact headers)
// ═══════════════════════════════════════════════════════════════════
function StatChip({ icon, value, color, dimmed = false, onClick }) {
  return (
    <button
      onClick={onClick}
      className="press"
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '6px 10px 6px 8px',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 999,
        color: dimmed ? TOKENS.ink3 : '#fff',
        cursor: 'pointer',
        font: 'inherit',
      }}
    >
      <span style={{ color, display: 'inline-flex', opacity: dimmed ? 0.45 : 1 }}>{icon}</span>
      <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: '-0.01em' }}>{value}</span>
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════
// TAB BAR — bottom nav (Home / Explore / Practice / Favorites / Journey)
// ═══════════════════════════════════════════════════════════════════
function TabBar({ active = 'journey', onChange }) {
  const items = [
    { id: 'home',      label: 'Home',      icon: <Icon.Home width="22" height="22"/> },
    { id: 'explore',   label: 'Explore',   icon: <Icon.Compass width="22" height="22"/> },
    { id: 'practice',  label: 'Practice',  icon: <Icon.Dumbbell width="22" height="22"/> },
    { id: 'favorites', label: 'Favorites', icon: <Icon.StarOutline width="22" height="22"/> },
    { id: 'journey',   label: 'Journey',   icon: <Icon.Trail width="22" height="22"/> },
  ];
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 0,
      padding: '10px 8px 28px',
      background: 'linear-gradient(to top, rgba(7,16,42,0.98) 60%, rgba(7,16,42,0))',
      display: 'flex', justifyContent: 'space-around',
      zIndex: 25,
    }}>
      {items.map((it) => {
        const isActive = it.id === active;
        return (
          <button
            key={it.id}
            onClick={() => onChange && onChange(it.id)}
            className="press"
            style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              padding: '8px 4px',
              background: isActive ? 'rgba(56,209,255,0.08)' : 'transparent',
              border: isActive ? '1.5px solid rgba(56,209,255,0.35)' : '1.5px solid transparent',
              borderRadius: 14,
              color: isActive ? TOKENS.cyan : TOKENS.ink3,
              cursor: 'pointer',
            }}
          >
            {it.icon}
            <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.02em' }}>{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// IMAGE PLACEHOLDER — subtle striped SVG with mono label
// ═══════════════════════════════════════════════════════════════════
function ImagePlaceholder({ label = 'cover', w = 120, h = 120, radius = 22, theme = 'cook' }) {
  const themes = {
    cook:   { a: '#2E3F63', b: '#3B547F', fg: 'rgba(255,255,255,0.5)' },
    home:   { a: '#3A3A62', b: '#4F4F80', fg: 'rgba(255,255,255,0.5)' },
    travel: { a: '#2B5B5B', b: '#3C7F7F', fg: 'rgba(255,255,255,0.5)' },
    work:   { a: '#5B3A62', b: '#7F4F80', fg: 'rgba(255,255,255,0.5)' },
  };
  const t = themes[theme] || themes.cook;
  const id = React.useMemo(() => 'ip-' + Math.random().toString(36).slice(2, 8), []);
  return (
    <div style={{
      width: w, height: h, borderRadius: radius,
      background: `linear-gradient(135deg, ${t.a}, ${t.b})`,
      position: 'relative', overflow: 'hidden',
      boxShadow: '0 8px 20px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.08)',
    }}>
      <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: 0.25 }}>
        <defs>
          <pattern id={id} x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="4" height="8" fill={t.fg} />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${id})`} />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: '"JetBrains Mono", ui-monospace, monospace',
        fontSize: 10, fontWeight: 600,
        color: 'rgba(255,255,255,0.7)', letterSpacing: '0.05em',
        textAlign: 'center', padding: 6, lineHeight: 1.2,
      }}>
        {label}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// REAL JOURNEY DATA — from digital-polyglot-library/src/app/journey
// Structure matches JourneyVariantTrack / JourneyLevelPlan / JourneyTopicPlan
// ═══════════════════════════════════════════════════════════════════
const JOURNEY_DATA = {
  // user profile (from screenshots: streak 0, XP 0, energy 16)
  user: {
    name: 'Yuri',
    flag: 'de',                    // currently studying German in the caps
    streak: 0,
    streakBest: 12,
    xpToday: 0,
    xpTotal: 340,
    gems: 240,
    energy: 16,
    energyMax: 30,
    level: 'A1',
    placement: 'a1',
    focus: 'Culture',
    dailyMinutes: 15,
  },

  // levels with topics (A1 LATAM Spanish curriculum — real slugs & labels)
  levels: [
    {
      id: 'a1', title: 'A1', subtitle: 'First steps', unlocked: true,
      topics: [
        { slug: 'community-celebrations', label: 'Community & Celebrations', icon: 'FerrisWheel',
          tint: ['#C4B5FD', '#A78BFA'], stories: 4, completed: 2, due: 0 },
        { slug: 'food-daily-life', label: 'Food & Everyday Life', icon: 'ChefHat',
          tint: ['#FCD34D', '#BEF264'], stories: 4, completed: 1, due: 1 },
        { slug: 'places-getting-around', label: 'Places & Getting Around', icon: 'BusFront',
          tint: ['#7DD3FC', '#67E8F9'], stories: 4, completed: 0, due: 0, current: true },
        { slug: 'home-family', label: 'Home & Family', icon: 'HeartHandshake',
          tint: ['#FDA4AF', '#FB923C'], stories: 1, completed: 0, due: 0, locked: true },
        { slug: 'nature-adventure', label: 'Nature & Adventure', icon: 'Leaf',
          tint: ['#6EE7B7', '#5EEAD4'], stories: 4, completed: 0, due: 0, locked: true },
        { slug: 'legends-folklore', label: 'Legends & Folklore', icon: 'Sparkle',
          tint: ['#C4B5FD', '#818CF8'], stories: 4, completed: 0, due: 0, locked: true },
      ],
    },
    { id: 'a2', title: 'A2', subtitle: 'Building confidence', unlocked: false, topics: [] },
    { id: 'b1', title: 'B1', subtitle: 'Real conversations', unlocked: false, topics: [] },
    { id: 'b2', title: 'B2', subtitle: 'Fluency shaping', unlocked: false, topics: [] },
    { id: 'c1', title: 'C1', subtitle: 'Advanced nuance', unlocked: false, topics: [] },
    { id: 'c2', title: 'C2', subtitle: 'Mastery', unlocked: false, topics: [] },
  ],

  // sample stories (real slugs from journeyCurriculum.ts)
  sampleStories: {
    'places-getting-around': [
      { slug: 'el-tren-de-la-sabana', title: 'El tren de la Sabana', mins: 4, done: false, current: true },
      { slug: 'el-viaje-a-villa-de-leyva', title: 'El viaje a Villa de Leyva', mins: 5, done: false },
      { slug: 'el-tesoro-escondido', title: 'El tesoro escondido', mins: 6, done: false },
      { slug: 'el-misterio-de-la-catedral-de-sal', title: 'El misterio de la Catedral de Sal', mins: 6, done: false },
    ],
    'food-daily-life': [
      { slug: 'el-mercado-de-medellin', title: 'El mercado de Medellín', mins: 4, done: true },
      { slug: 'el-secreto-del-cafe', title: 'El secreto del café', mins: 5, done: false, current: true },
      { slug: 'el-festival-de-la-arepa', title: 'El festival de la arepa', mins: 5, done: false },
      { slug: 'el-misterio-del-bosque', title: 'El misterio del bosque', mins: 6, done: false },
    ],
    'community-celebrations': [
      { slug: 'el-baile-en-la-plaza', title: 'El baile en la plaza', mins: 4, done: true },
      { slug: 'el-carnaval-de-barranquilla', title: 'El carnaval de Barranquilla', mins: 5, done: true },
      { slug: 'la-feria-de-las-flores', title: 'La feria de las flores', mins: 5, done: false },
      { slug: 'la-fiesta-en-cartagena', title: 'La fiesta en Cartagena', mins: 5, done: false },
    ],
  },

  // journey insights (mirrors buildJourneyTrackInsights)
  insights: {
    score: 13,                     // %
    completedSteps: 3,
    totalSteps: 23,
    currentLevelTitle: 'A1',
    nextMilestone: 'Finish Places & Getting Around',
    completedRequiredStories: 3,
    totalRequiredStories: 6,
    practicedTopicCount: 1,
    totalTopicCount: 6,
    passedCheckpointCount: 0,
    totalCheckpointCount: 6,
    dueReviewCount: 2,
    dueTopicCount: 1,
  },
};

// ═══════════════════════════════════════════════════════════════════
// TOPIC ICONS — extended set matching real topicVisuals (lucide-ish)
// ═══════════════════════════════════════════════════════════════════
const TopicIcon = {
  ChefHat: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M6 14v7h12v-7"/><path d="M6 14a4 4 0 01-1-7.7A5 5 0 0112 4a5 5 0 017 2.3A4 4 0 0118 14H6z"/><path d="M9 14v4M15 14v4"/></svg>,
  BusFront: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M5 17V8a3 3 0 013-3h8a3 3 0 013 3v9"/><rect x="4" y="13" width="16" height="4" rx="1"/><circle cx="8" cy="18.5" r="1.5"/><circle cx="16" cy="18.5" r="1.5"/><path d="M7 9h10M10 5v3M14 5v3"/></svg>,
  FerrisWheel: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="10" r="7"/><circle cx="12" cy="10" r="1.5"/><path d="M12 3v14M5 10h14M7.1 5.1l9.8 9.8M16.9 5.1l-9.8 9.8"/><path d="M9 20l3-5 3 5"/></svg>,
  HeartHandshake: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M20 10c0-3-2-5-5-5-2 0-3 1-3 1s-1-1-3-1c-3 0-5 2-5 5 0 6 8 11 8 11s3-1.8 5.5-4.5"/><path d="M13 15l2-2M15 13l3 3 2-2-3-3"/></svg>,
  Leaf: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M20 4s-3 9-10 11c-3 1-6-1-6-5C4 5 14 3 20 4z"/><path d="M4 20c3-7 8-11 14-13"/></svg>,
  Sparkle: (p) => <svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M12 2l2 7 7 3-7 3-2 7-2-7-7-3 7-3 2-7z"/></svg>,
  Briefcase: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2"/><path d="M3 13h18"/></svg>,
  Store: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 9l1-5h16l1 5"/><path d="M3 9c0 1.5 1 3 3 3s3-1.5 3-3M9 9c0 1.5 1.3 3 3 3s3-1.5 3-3M15 9c0 1.5 1 3 3 3s3-1.5 3-3"/><path d="M5 12v8h14v-8M10 20v-5h4v5"/></svg>,
  Lightbulb: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 00-4 10.5c.7.6 1 1.4 1 2.5v1h6v-1c0-1.1.3-1.9 1-2.5A6 6 0 0012 3z"/></svg>,
};

// ═══════════════════════════════════════════════════════════════════
// FLAGS — circular flags for language switcher
// ═══════════════════════════════════════════════════════════════════
function Flag({ code, size = 40 }) {
  const id = React.useMemo(() => 'fc-' + code + '-' + Math.random().toString(36).slice(2, 8), [code]);
  const r = size / 2;

  const flagContent = {
    de: ( // Germany: black/red/gold horizontal
      <>
        <rect x="0" y="0" width={size} height={size/3} fill="#1a1a1a"/>
        <rect x="0" y={size/3} width={size} height={size/3} fill="#D93841"/>
        <rect x="0" y={size*2/3} width={size} height={size/3} fill="#F2C200"/>
      </>
    ),
    es: ( // Spain (LATAM proxy): red/yellow/red with gold mark
      <>
        <rect x="0" y="0" width={size} height={size*0.27} fill="#C8102E"/>
        <rect x="0" y={size*0.27} width={size} height={size*0.46} fill="#F2C200"/>
        <rect x="0" y={size*0.73} width={size} height={size*0.27} fill="#C8102E"/>
      </>
    ),
    'es-mx': ( // Mexico: green/white/red vertical
      <>
        <rect x="0" y="0" width={size/3} height={size} fill="#006847"/>
        <rect x={size/3} y="0" width={size/3} height={size} fill="#fff"/>
        <rect x={size*2/3} y="0" width={size/3} height={size} fill="#CE1126"/>
      </>
    ),
    fr: ( // France: blue/white/red vertical
      <>
        <rect x="0" y="0" width={size/3} height={size} fill="#0055A4"/>
        <rect x={size/3} y="0" width={size/3} height={size} fill="#fff"/>
        <rect x={size*2/3} y="0" width={size/3} height={size} fill="#EF4135"/>
      </>
    ),
    it: ( // Italy: green/white/red vertical
      <>
        <rect x="0" y="0" width={size/3} height={size} fill="#009246"/>
        <rect x={size/3} y="0" width={size/3} height={size} fill="#fff"/>
        <rect x={size*2/3} y="0" width={size/3} height={size} fill="#CE2B37"/>
      </>
    ),
    pt: ( // Portugal: green/red vertical
      <>
        <rect x="0" y="0" width={size*0.4} height={size} fill="#006600"/>
        <rect x={size*0.4} y="0" width={size*0.6} height={size} fill="#D52B1E"/>
      </>
    ),
    jp: ( // Japan: white with red dot
      <>
        <rect x="0" y="0" width={size} height={size} fill="#fff"/>
        <circle cx={r} cy={r} r={size*0.22} fill="#BC002D"/>
      </>
    ),
    zh: ( // China: red with yellow star
      <>
        <rect x="0" y="0" width={size} height={size} fill="#DE2910"/>
        <path d="M12 14l1.5 4.5L18 19l-3.5 2.5L16 26l-4-3-4 3 1.5-4.5L6 19l4.5-.5L12 14z" fill="#FFDE00"
              transform={`scale(${size/40}) translate(${40/size * 2}, ${40/size * 2})`}/>
      </>
    ),
  };

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <defs>
        <clipPath id={id}><circle cx={r} cy={r} r={r}/></clipPath>
      </defs>
      <g clipPath={`url(#${id})`}>
        {flagContent[code] || flagContent.es}
      </g>
      <circle cx={r} cy={r} r={r - 0.5} fill="none" stroke="rgba(255,255,255,0.15)"/>
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════
// USER LANGUAGES — Yuri's targetLanguages (per shape in HomeClient.tsx)
// Currently active = [0] (convention inherited from real code)
// ═══════════════════════════════════════════════════════════════════
const USER_LANGUAGES = [
  {
    id: 'de',
    name: 'German',
    code: 'DE',
    flag: 'de',
    level: 'A1',
    levelLabel: 'First steps',
    streak: 0,
    xpTotal: 340,
    progress: 13,                    // % in current level
    dueReviews: 2,
    lastStudiedLabel: 'Just now',
    active: true,
  },
  {
    id: 'es-co',
    name: 'Spanish',
    code: 'ES',
    variant: 'Colombia',
    flag: 'es',
    level: 'A2',
    levelLabel: 'Building confidence',
    streak: 18,
    xpTotal: 2140,
    progress: 42,
    dueReviews: 5,
    lastStudiedLabel: 'Yesterday',
    active: false,
  },
  {
    id: 'fr',
    name: 'French',
    code: 'FR',
    flag: 'fr',
    level: 'A1',
    levelLabel: 'First steps',
    streak: 3,
    xpTotal: 210,
    progress: 8,
    dueReviews: 0,
    lastStudiedLabel: '4 days ago',
    active: false,
  },
  {
    id: 'it',
    name: 'Italian',
    code: 'IT',
    flag: 'it',
    level: 'A1',
    levelLabel: 'Just started',
    streak: 0,
    xpTotal: 45,
    progress: 2,
    dueReviews: 0,
    lastStudiedLabel: '2 weeks ago',
    active: false,
  },
];

// expose globally (Babel scripts don't share scope)
Object.assign(window, { TOKENS, StatusBar, Icon, GermanFlag, Flag, StatChip, TabBar, ImagePlaceholder, JOURNEY_DATA, TopicIcon, USER_LANGUAGES });
