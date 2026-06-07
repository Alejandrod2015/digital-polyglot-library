/* email-kit.jsx — Digital Polyglot lifecycle email system.
   App-native: warm navy + top radial lift, Nunito 900 headlines with one gold
   word, rounded yellow CTA, real product modules. 560px. No em dashes. */

const DPE = {
  navy:    '#051834',
  navyTop: '#0c2c54',
  screen:  '#07203f',
  card:    '#0c2950',
  cardLine:'rgba(125,211,252,0.16)',
  hair:    'rgba(255,255,255,0.08)',
  fg:      '#eef4fc',
  fgSoft:  '#c2d2e8',
  muted:   '#8aa0be',
  faint:   '#54708f',
  gold:    '#fcd34d',
  goldInk: '#2a1a02',
  sky:     '#7dd3fc',
  green:   '#5fd0a3',
  blue:    '#2f6df6',
  font:    "'Nunito', -apple-system, 'Segoe UI', sans-serif",
};
const navyBg = `radial-gradient(120% 62% at 50% 0%, ${DPE.navyTop} 0%, #06203f 42%, ${DPE.navy} 74%)`;

function Mark({ size = 38, radius = 11 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: radius, flexShrink: 0,
      background: 'linear-gradient(135deg,#fcd34d 0%, #7dd3fc 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 6px 18px -6px rgba(125,211,252,0.45)' }}>
      <span style={{ fontWeight: 900, fontSize: size * 0.4, color: DPE.navy, letterSpacing: '-0.04em' }}>dp</span>
    </div>
  );
}

function CTA({ children, block }) {
  return (
    <a href="#" style={{ display: block ? 'flex' : 'inline-flex', textAlign: 'center',
      alignItems: 'center', justifyContent: 'center', gap: 8,
      background: 'linear-gradient(180deg,#fde08a 0%, #fcd34d 58%, #f4c430 100%)',
      color: DPE.goldInk, fontWeight: 900, fontSize: 16.5, letterSpacing: '-0.01em',
      textDecoration: 'none', padding: block ? '17px 28px' : '16px 32px', borderRadius: 14,
      boxShadow: '0 12px 28px -10px rgba(252,211,77,0.65), inset 0 1px 0 rgba(255,255,255,0.55)' }}>
      {children}
    </a>
  );
}

function Eyebrow({ children, color = DPE.gold, style }) {
  return (
    <div style={{ fontWeight: 800, fontSize: 11.5, letterSpacing: '0.22em',
      textTransform: 'uppercase', color, ...style }}>{children}</div>
  );
}

function Hi({ children, tone }) {
  const sky = tone !== 'gold';
  return (
    <span style={{ background: sky ? 'rgba(125,211,252,0.92)' : 'rgba(252,211,77,0.92)',
      color: DPE.navy, borderRadius: 5, padding: '1px 5px', fontWeight: 800,
      boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone' }}>{children}</span>
  );
}

function Badge({ children, tone = 'sky' }) {
  const map = {
    sky:  ['rgba(125,211,252,0.14)', DPE.sky],
    gold: ['rgba(252,211,77,0.16)', DPE.gold],
    green:['rgba(95,208,163,0.16)', DPE.green],
  };
  const [bg, col] = map[tone];
  return (
    <span style={{ fontWeight: 800, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase',
      color: col, background: bg, padding: '3px 8px', borderRadius: 5, whiteSpace: 'nowrap' }}>{children}</span>
  );
}

/* big metric tile (weekly recap, celebration) */
function StatTile({ n, unit, label, tone = 'gold' }) {
  const col = tone === 'sky' ? DPE.sky : tone === 'green' ? DPE.green : DPE.gold;
  return (
    <div style={{ flex: 1, background: DPE.screen, border: `1px solid ${DPE.cardLine}`,
      borderRadius: 16, padding: '20px 14px', textAlign: 'center' }}>
      <div style={{ fontWeight: 900, fontSize: 38, lineHeight: 1, letterSpacing: '-0.03em', color: col }}>
        {n}{unit && <span style={{ fontSize: 18, marginLeft: 2 }}>{unit}</span>}
      </div>
      <div style={{ marginTop: 9, fontWeight: 800, fontSize: 11.5, letterSpacing: '0.08em',
        textTransform: 'uppercase', color: DPE.muted }}>{label}</div>
    </div>
  );
}

/* compact stat chip (inline) */
function StatChip({ n, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: DPE.screen,
      border: `1px solid ${DPE.cardLine}`, borderRadius: 12, padding: '12px 16px' }}>
      <span style={{ fontWeight: 900, fontSize: 22, color: DPE.gold, letterSpacing: '-0.02em' }}>{n}</span>
      <span style={{ fontWeight: 700, fontSize: 13, color: DPE.fgSoft, lineHeight: 1.2 }}>{label}</span>
    </div>
  );
}

function ProgressBar({ pct }) {
  return (
    <div style={{ height: 7, borderRadius: 4, background: 'rgba(125,211,252,0.16)', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: pct + '%', borderRadius: 4,
        background: 'linear-gradient(90deg,#fcd34d,#f4c430)' }} />
    </div>
  );
}

/* horizontal story card (cover + meta), optional progress / teaser */
function StoryCardH({ cover, title, level, meta, teaser, pct, pctLabel, badge }) {
  return (
    <div style={{ display: 'flex', gap: 16, background: DPE.screen, borderRadius: 16,
      border: `1px solid ${DPE.cardLine}`, padding: 16, boxShadow: '0 18px 40px -22px rgba(0,0,0,0.7)' }}>
      <img src={cover} alt="" style={{ width: 84, height: 116, objectFit: 'cover', borderRadius: 11,
        flexShrink: 0, boxShadow: '0 10px 22px -10px rgba(0,0,0,0.7)' }} />
      <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          {level && <Badge>{level}</Badge>}
          {badge && <Badge tone="gold">{badge}</Badge>}
          {meta && <span style={{ fontWeight: 700, fontSize: 11.5, color: DPE.faint, whiteSpace: 'nowrap' }}>{meta}</span>}
        </div>
        <div style={{ fontWeight: 900, fontSize: 18, color: DPE.fg, letterSpacing: '-0.015em' }}>{title}</div>
        {teaser && (
          <p style={{ margin: '7px 0 0', fontWeight: 700, fontSize: 13.5, lineHeight: 1.5, color: DPE.fgSoft }}>{teaser}</p>
        )}
        {typeof pct === 'number' && (
          <div style={{ marginTop: 12 }}>
            <ProgressBar pct={pct} />
            <div style={{ marginTop: 7, fontWeight: 800, fontSize: 11.5, color: DPE.gold }}>{pctLabel}</div>
          </div>
        )}
      </div>
    </div>
  );
}

/* vertical mini story card (grid of next stories) */
function StoryCardV({ cover, title, level, meta, badge }) {
  return (
    <div style={{ flex: 1, minWidth: 0, background: DPE.screen, border: `1px solid ${DPE.cardLine}`,
      borderRadius: 14, padding: 12, textAlign: 'left' }}>
      <div style={{ position: 'relative' }}>
        <img src={cover} alt="" style={{ width: '100%', height: 132, objectFit: 'cover', borderRadius: 9,
          display: 'block', boxShadow: '0 8px 18px -10px rgba(0,0,0,0.7)' }} />
        {badge && <div style={{ position: 'absolute', top: 8, left: 8 }}>
          <span style={{ fontWeight: 900, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase',
            color: DPE.goldInk, background: DPE.gold, padding: '3px 8px', borderRadius: 5,
            boxShadow: '0 4px 10px -3px rgba(0,0,0,0.5)' }}>{badge}</span>
        </div>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '11px 0 6px' }}>
        {level && <Badge>{level}</Badge>}
        {meta && <span style={{ fontWeight: 700, fontSize: 10.5, color: DPE.faint, whiteSpace: 'nowrap' }}>{meta}</span>}
      </div>
      <div style={{ fontWeight: 900, fontSize: 14.5, color: DPE.fg, letterSpacing: '-0.01em', lineHeight: 1.2 }}>{title}</div>
    </div>
  );
}

/* tap-a-word proof (used in welcome phone + how-it-works) */
function VocabCard({ scale = 1 }) {
  const s = (n) => Math.round(n * scale * 10) / 10;
  return (
    <div style={{ background: DPE.card, border: '1px solid rgba(125,211,252,0.30)',
      borderRadius: s(15), padding: `${s(13)}px ${s(15)}px ${s(14)}px`,
      boxShadow: '0 16px 34px -14px rgba(0,0,0,0.6)', textAlign: 'left' }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <span style={{ fontWeight: 900, fontSize: s(18), color: DPE.fg }}>fonda</span>
        <span style={{ marginLeft: 'auto', width: s(20), height: s(20), borderRadius: '50%',
          background: 'rgba(255,255,255,0.08)', color: DPE.muted, fontSize: s(13),
          lineHeight: `${s(20)}px`, textAlign: 'center', fontWeight: 700 }}>×</span>
      </div>
      <div style={{ display: 'inline-block', marginTop: s(8), background: 'rgba(125,211,252,0.18)',
        color: DPE.sky, fontWeight: 800, fontSize: s(10), letterSpacing: '0.12em',
        textTransform: 'uppercase', padding: `${s(3)}px ${s(8)}px`, borderRadius: s(5) }}>Noun</div>
      <div style={{ marginTop: s(9), fontWeight: 600, fontSize: s(14), color: DPE.fgSoft, lineHeight: 1.4 }}>
        Small, home-style Mexican eatery
      </div>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: s(7), marginTop: s(12),
        border: '1.5px solid rgba(125,211,252,0.55)', color: DPE.sky, fontWeight: 800,
        fontSize: s(13), padding: `${s(7)}px ${s(14)}px`, borderRadius: 999, whiteSpace: 'nowrap' }}>
        <span style={{ fontSize: s(13) }}>♡</span> Save word
      </div>
    </div>
  );
}

function AudioBar({ scale = 1, play }) {
  const s = (n) => Math.round(n * scale * 10) / 10;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: s(12) }}>
      {play && (
        <div style={{ width: s(40), height: s(40), borderRadius: '50%', background: DPE.blue,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          boxShadow: '0 8px 20px -6px rgba(47,109,246,0.7)' }}>
          <span style={{ color: '#fff', fontSize: s(14), letterSpacing: s(1) }}>❚❚</span>
        </div>
      )}
      <span style={{ fontWeight: 800, fontSize: s(12), color: DPE.muted, fontVariantNumeric: 'tabular-nums' }}>0:31</span>
      <div style={{ flex: 1, height: s(5), borderRadius: 3, background: 'rgba(125,211,252,0.18)', position: 'relative' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '44%', borderRadius: 3,
          background: 'linear-gradient(90deg,#7dd3fc,#2f6df6)' }} />
        <div style={{ position: 'absolute', left: '44%', top: '50%', transform: 'translate(-50%,-50%)',
          width: s(13), height: s(13), borderRadius: '50%', background: '#fff', boxShadow: '0 2px 6px rgba(0,0,0,0.4)' }} />
      </div>
      <span style={{ fontWeight: 800, fontSize: s(12), color: DPE.muted, fontVariantNumeric: 'tabular-nums' }}>1:10</span>
    </div>
  );
}

function CoverArt({ height = 116, radius = 13 }) {
  return (
    <div style={{ height, borderRadius: radius, position: 'relative', overflow: 'hidden',
      background: 'linear-gradient(135deg,#f1e4c6 0%, #e7b27a 45%, #c96b4a 100%)',
      boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.06)' }}>
      <div style={{ position: 'absolute', inset: 0, opacity: 0.5,
        background: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.10) 0 2px, transparent 2px 12px)' }} />
      <div style={{ position: 'absolute', right: -20, top: -24, width: 110, height: 110, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,255,255,0.35), transparent 70%)' }} />
    </div>
  );
}

function PhoneFrame({ width = 300, children }) {
  return (
    <div style={{ width, borderRadius: 44, padding: 9,
      background: 'linear-gradient(165deg,#0c2244 0%, #02101f 100%)',
      boxShadow: '0 36px 70px -24px rgba(0,0,0,0.75), inset 0 0 0 1px rgba(125,211,252,0.14)' }}>
      <div style={{ position: 'relative', borderRadius: 36, overflow: 'hidden', background: DPE.screen }}>
        <div style={{ position: 'absolute', top: 9, left: '50%', transform: 'translateX(-50%)',
          width: 96, height: 24, borderRadius: 13, background: '#02101f', zIndex: 2 }} />
        {children}
      </div>
    </div>
  );
}

function Footer({ align = 'center', note }) {
  return (
    <div style={{ padding: '28px 44px 34px', textAlign: align }}>
      <div style={{ height: 1, background: DPE.hair, marginBottom: 22 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 9,
        justifyContent: align === 'center' ? 'center' : 'flex-start', marginBottom: 11 }}>
        <Mark size={22} radius={6} />
        <span style={{ fontWeight: 900, fontSize: 14, color: DPE.fg, letterSpacing: '-0.01em' }}>Digital Polyglot</span>
      </div>
      <div style={{ fontWeight: 600, fontSize: 12, color: DPE.faint, lineHeight: 1.7 }}>
        {note || "You're receiving this as part of your Digital Polyglot account."}<br />
        <a href="#" style={{ color: DPE.muted, textDecoration: 'underline' }}>Manage emails</a>
        &nbsp;·&nbsp;
        <a href="#" style={{ color: DPE.muted, textDecoration: 'underline' }}>Unsubscribe</a>
      </div>
    </div>
  );
}

/* shell: 560 navy email with centered content + footer */
function Email({ children, footerAlign = 'center', footerNote }) {
  return (
    <div style={{ width: 560, background: navyBg, fontFamily: DPE.font }}>
      {children}
      <Footer align={footerAlign} note={footerNote} />
    </div>
  );
}

Object.assign(window, {
  DPE, navyBg, Mark, CTA, Eyebrow, Hi, Badge, StatTile, StatChip, ProgressBar,
  StoryCardH, StoryCardV, VocabCard, AudioBar, CoverArt, PhoneFrame, Footer, Email,
});
