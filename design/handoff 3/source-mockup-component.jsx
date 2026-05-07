// language-switcher.jsx — 3 variants of the language switcher bottom sheet
// All render over a dimmed Journey backdrop.

// ════════════════════════════════════════════════════════════════
// SHARED — backdrop that dims the Journey and holds the sheet
// ════════════════════════════════════════════════════════════════
function SheetShell({ children, heightPx = 480 }) {
  const T = window.TOKENS;
  return (
    <div className="phone" style={{
      background: '#08264d', position: 'relative',
    }}>
      {/* Dimmed Journey visible behind */}
      <div style={{
        position: 'absolute', inset: 0,
        transform: 'scale(0.96)',
        filter: 'brightness(0.45) blur(1px)',
        pointerEvents: 'none',
      }}>
        <window.VariantD2Stations/>
      </div>
      {/* scrim */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'rgba(5,24,52,0.55)',
      }}/>
      {/* sheet */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        height: heightPx,
        background: 'linear-gradient(180deg, #0a2b56 0%, #051834 100%)',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        border: `1px solid ${T.line}`,
        borderBottom: 'none',
        boxShadow: '0 -20px 50px rgba(0,0,0,0.6)',
        color: '#fff',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* grabber */}
        <div style={{
          width: 44, height: 5, borderRadius: 999,
          background: 'rgba(255,255,255,0.25)',
          margin: '10px auto 0',
        }}/>
        {children}
      </div>
      <div className="home-ind"/>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// VARIANT A — Minimal: big flags, just name + level, 1-tap switch
// ════════════════════════════════════════════════════════════════
function LangSheetA() {
  const T = window.TOKENS;
  const langs = window.USER_LANGUAGES;

  return (
    <SheetShell heightPx={480}>
      <div style={{ padding: '18px 22px 6px' }}>
        <div style={{
          fontSize: 10.5, fontWeight: 900, letterSpacing: '0.22em',
          color: T.ink3,
        }}>SWITCH LANGUAGE</div>
        <div style={{
          fontSize: 22, fontWeight: 900, letterSpacing: '-0.02em',
          color: T.ink0, marginTop: 4,
        }}>Your journeys</div>
      </div>

      <div style={{
        flex: 1, overflowY: 'auto', padding: '12px 16px 0',
        display: 'flex', flexDirection: 'column', gap: 6,
        scrollbarWidth: 'none',
      }}>
        {langs.map((L) => (
          <LangRowMinimal key={L.id} lang={L}/>
        ))}
      </div>

      <div style={{ padding: '10px 16px 22px' }}>
        <button className="press" style={{
          width: '100%', padding: '14px 16px', borderRadius: 14,
          background: 'rgba(255,255,255,0.04)',
          border: `1px dashed ${T.dash}`,
          color: T.ink1, fontSize: 13.5, fontWeight: 800,
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <window.Icon.Plus width="16" height="16"/>
          Add a language
        </button>
      </div>
    </SheetShell>
  );
}

function LangRowMinimal({ lang }) {
  const T = window.TOKENS;
  return (
    <button className="press" style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '12px 14px', borderRadius: 16,
      background: lang.active
        ? 'rgba(190,242,100,0.08)'
        : 'transparent',
      border: lang.active
        ? '1.5px solid rgba(190,242,100,0.35)'
        : '1.5px solid transparent',
      cursor: 'pointer', textAlign: 'left',
    }}>
      <window.Flag code={lang.flag} size={46}/>
      <div style={{ flex: 1 }}>
        <div style={{
          fontSize: 16, fontWeight: 900, color: T.ink0,
          letterSpacing: '-0.015em',
        }}>{lang.name}</div>
        <div style={{
          fontSize: 11.5, fontWeight: 700, color: T.ink2,
          marginTop: 1,
        }}>
          {lang.level} · {lang.levelLabel}
        </div>
      </div>
      {lang.active ? (
        <div style={{
          padding: '4px 10px', borderRadius: 999,
          background: T.lime, color: '#0a2b56',
          fontSize: 10, fontWeight: 900, letterSpacing: '0.14em',
        }}>ACTIVE</div>
      ) : (
        <window.Icon.Chevron width="16" height="16" style={{ color: T.ink3 }}/>
      )}
    </button>
  );
}

// ════════════════════════════════════════════════════════════════
// VARIANT B — With stats: streak, XP, progress ring per language
// ════════════════════════════════════════════════════════════════
function LangSheetB() {
  const T = window.TOKENS;
  const langs = window.USER_LANGUAGES;

  return (
    <SheetShell heightPx={560}>
      <div style={{ padding: '18px 22px 4px' }}>
        <div style={{
          fontSize: 10.5, fontWeight: 900, letterSpacing: '0.22em',
          color: T.ink3,
        }}>SWITCH LANGUAGE</div>
        <div style={{
          fontSize: 22, fontWeight: 900, letterSpacing: '-0.02em',
          color: T.ink0, marginTop: 4,
        }}>4 journeys in progress</div>
      </div>

      <div style={{
        flex: 1, overflowY: 'auto', padding: '10px 16px 0',
        display: 'flex', flexDirection: 'column', gap: 8,
        scrollbarWidth: 'none',
      }}>
        {langs.map((L) => (
          <LangRowStats key={L.id} lang={L}/>
        ))}
      </div>

      <div style={{
        padding: '12px 16px 22px',
        borderTop: `1px solid ${T.line}`,
        display: 'flex', gap: 8,
      }}>
        <button className="press" style={{
          flex: 1, padding: '12px', borderRadius: 14,
          background: 'rgba(255,255,255,0.04)',
          border: `1px solid ${T.line}`,
          color: T.ink1, fontSize: 12.5, fontWeight: 800,
          cursor: 'pointer',
        }}>See all</button>
        <button className="press" style={{
          flex: 1, padding: '12px', borderRadius: 14,
          background: 'rgba(125,211,252,0.08)',
          border: '1px solid rgba(125,211,252,0.28)',
          color: T.sky, fontSize: 12.5, fontWeight: 800,
          cursor: 'pointer',
        }}>+ Add language</button>
      </div>
    </SheetShell>
  );
}

function LangRowStats({ lang }) {
  const T = window.TOKENS;
  // progress ring data
  const size = 46;
  const r = (size - 5) / 2;
  const c = 2 * Math.PI * r;
  const dash = (lang.progress / 100) * c;

  return (
    <button className="press" style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px', borderRadius: 18,
      background: lang.active
        ? 'linear-gradient(135deg, rgba(190,242,100,0.12), rgba(125,211,252,0.06))'
        : 'rgba(255,255,255,0.035)',
      border: lang.active
        ? '1.5px solid rgba(190,242,100,0.4)'
        : `1px solid ${T.line}`,
      cursor: 'pointer', textAlign: 'left',
    }}>
      {/* flag with progress ring */}
      <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
        <svg width={size} height={size} style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
          <circle cx={size/2} cy={size/2} r={r} fill="none"
                  stroke="rgba(255,255,255,0.08)" strokeWidth="2.5"/>
          <circle cx={size/2} cy={size/2} r={r} fill="none"
                  stroke={lang.active ? T.lime : T.sky} strokeWidth="2.5" strokeLinecap="round"
                  strokeDasharray={`${dash} ${c}`}/>
        </svg>
        <div style={{
          position: 'absolute', inset: 3,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <window.Flag code={lang.flag} size={size - 10}/>
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'nowrap', overflow: 'hidden' }}>
          <span style={{ fontSize: 15.5, fontWeight: 900, color: T.ink0, letterSpacing: '-0.015em', whiteSpace: 'nowrap' }}>
            {lang.name}
          </span>
          {lang.variant && (
            <span style={{ fontSize: 10, fontWeight: 700, color: T.ink3, letterSpacing: '-0.005em', whiteSpace: 'nowrap' }}>
              · {lang.variant}
            </span>
          )}
        </div>

        {/* stats row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
          <MiniStat
            icon={<window.Icon.Flame width="11" height="11"/>}
            value={lang.streak}
            color={lang.streak > 0 ? T.streak : T.ink3}
          />
          <MiniStat
            icon={<window.Icon.Bolt width="11" height="11"/>}
            value={lang.xpTotal >= 1000 ? `${(lang.xpTotal/1000).toFixed(1)}k` : lang.xpTotal}
            color={T.lime}
          />
          <div style={{
            padding: '2px 7px', borderRadius: 6,
            background: 'rgba(125,211,252,0.1)',
            fontSize: 9.5, fontWeight: 900, letterSpacing: '0.05em',
            color: T.sky,
          }}>{lang.level}</div>
        </div>
      </div>

      {lang.active ? (
        <div style={{
          padding: '4px 10px', borderRadius: 999,
          background: T.lime, color: '#0a2b56',
          fontSize: 9.5, fontWeight: 900, letterSpacing: '0.14em',
          flexShrink: 0,
        }}>ACTIVE</div>
      ) : (
        <window.Icon.Chevron width="16" height="16" style={{ color: T.ink3, flexShrink: 0 }}/>
      )}
    </button>
  );
}

function MiniStat({ icon, value, color }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 3,
      color,
    }}>
      <span style={{ opacity: 0.9, display: 'inline-flex' }}>{icon}</span>
      <span style={{
        fontSize: 12, fontWeight: 900, letterSpacing: '-0.02em',
      }}>{value}</span>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// VARIANT C — Emotional: highlights languages with attention needed
// Groups by "On a roll" / "Needs attention" / "Resting"
// ════════════════════════════════════════════════════════════════
function LangSheetC() {
  const T = window.TOKENS;
  const langs = window.USER_LANGUAGES;

  // group
  const onRoll  = langs.filter((l) => l.streak >= 3);
  const needsAttention = langs.filter((l) => l.streak < 3 && l.dueReviews > 0);
  const resting = langs.filter((l) => l.streak < 3 && l.dueReviews === 0);

  return (
    <SheetShell heightPx={600}>
      <div style={{ padding: '18px 22px 6px' }}>
        <div style={{
          fontSize: 10.5, fontWeight: 900, letterSpacing: '0.22em',
          color: T.ink3,
        }}>JUMP BACK IN</div>
        <div style={{
          fontSize: 22, fontWeight: 900, letterSpacing: '-0.02em',
          color: T.ink0, marginTop: 4, textWrap: 'balance',
        }}>Where would you like to go,<br/>Yuri?</div>
      </div>

      <div style={{
        flex: 1, overflowY: 'auto', padding: '14px 16px 0',
        display: 'flex', flexDirection: 'column', gap: 14,
        scrollbarWidth: 'none',
      }}>
        {onRoll.length > 0 && (
          <LangGroup
            title="On a roll"
            subtitle="Keep the streak alive"
            accent={T.streak}
            icon={<window.Icon.Flame width="13" height="13"/>}
            langs={onRoll}
            kind="roll"
          />
        )}
        {needsAttention.length > 0 && (
          <LangGroup
            title="Needs attention"
            subtitle={`${needsAttention.reduce((a, l) => a + l.dueReviews, 0)} words due for review`}
            accent={T.sky}
            icon={<window.Icon.Sparkle width="13" height="13"/>}
            langs={needsAttention}
            kind="attention"
          />
        )}
        {resting.length > 0 && (
          <LangGroup
            title="Resting"
            subtitle="Pick up where you left off"
            accent={T.ink3}
            icon={<window.Icon.Headphones width="13" height="13"/>}
            langs={resting}
            kind="resting"
          />
        )}
      </div>

      <div style={{ padding: '10px 16px 22px' }}>
        <button className="press" style={{
          width: '100%', padding: '13px 16px', borderRadius: 14,
          background: 'transparent',
          border: `1px solid ${T.line}`,
          color: T.ink2, fontSize: 12.5, fontWeight: 800,
          cursor: 'pointer',
        }}>Manage languages</button>
      </div>
    </SheetShell>
  );
}

function LangGroup({ title, subtitle, accent, icon, langs, kind }) {
  const T = window.TOKENS;
  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
        padding: '0 4px',
      }}>
        <div style={{ color: accent, display: 'inline-flex', flexShrink: 0 }}>{icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 11, fontWeight: 900, color: accent,
            letterSpacing: '0.12em', lineHeight: 1.2,
            whiteSpace: 'nowrap',
          }}>{title.toUpperCase()}</div>
          <div style={{
            fontSize: 10, fontWeight: 700, color: T.ink3,
            letterSpacing: '-0.005em', lineHeight: 1.3, marginTop: 2,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{subtitle}</div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {langs.map((L) => <LangRowEmotional key={L.id} lang={L} kind={kind}/>)}
      </div>
    </div>
  );
}

function LangRowEmotional({ lang, kind }) {
  const T = window.TOKENS;
  const isActive = lang.active;
  const kindStyles = {
    roll:      { bg: 'rgba(251,146,60,0.07)', border: 'rgba(251,146,60,0.22)' },
    attention: { bg: 'rgba(125,211,252,0.07)', border: 'rgba(125,211,252,0.22)' },
    resting:   { bg: 'rgba(255,255,255,0.03)', border: T.line },
  };
  const s = kindStyles[kind];

  return (
    <button className="press" style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 12px', borderRadius: 14,
      background: isActive ? 'rgba(190,242,100,0.1)' : s.bg,
      border: isActive ? '1.5px solid rgba(190,242,100,0.35)' : `1px solid ${s.border}`,
      cursor: 'pointer', textAlign: 'left',
    }}>
      <window.Flag code={lang.flag} size={34}/>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: T.ink1, letterSpacing: '-0.01em' }}>
          {lang.name}
        </div>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: T.ink2, marginTop: 1 }}>
          {kind === 'roll' && (
            <span style={{ color: T.streak }}>🔥 {lang.streak} day streak · {lang.level}</span>
          )}
          {kind === 'attention' && (
            <span style={{ color: T.sky }}>{lang.dueReviews} to review · {lang.lastStudiedLabel}</span>
          )}
          {kind === 'resting' && (
            <span>Last studied {lang.lastStudiedLabel.toLowerCase()} · {lang.level}</span>
          )}
        </div>
      </div>
      {isActive ? (
        <div style={{
          padding: '3px 8px', borderRadius: 999,
          background: T.lime, color: '#0a2b56',
          fontSize: 9, fontWeight: 900, letterSpacing: '0.14em',
        }}>ACTIVE</div>
      ) : (
        <window.Icon.Chevron width="14" height="14" style={{ color: T.ink3 }}/>
      )}
    </button>
  );
}

Object.assign(window, { LangSheetA, LangSheetB, LangSheetC });
