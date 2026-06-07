/* lifecycle-emails.jsx — the full Digital Polyglot sequence.
   Welcome = B (decided). Emails 2 to 7c, one alternative each.
   Shared look: navy + radial lift, centered, gold-accent headline, yellow CTA.
   Copy = definitive EN from the brief. No em dashes. */

/* ---- shared headline helper: centered, big, one gold word ---- */
function Head({ children, size = 38 }) {
  return (
    <h1 style={{ margin: 0, fontWeight: 900, fontSize: size, lineHeight: 1.04,
      letterSpacing: '-0.032em', color: DPE.fg }}>{children}</h1>
  );
}
function Lead({ children }) {
  return (
    <p style={{ margin: '15px auto 0', fontWeight: 600, fontSize: 16.5, lineHeight: 1.52,
      color: DPE.fgSoft, maxWidth: 396 }}>{children}</p>
  );
}
const Gold = ({ children }) => <span style={{ color: DPE.gold }}>{children}</span>;

/* ============================================================
   1 · WELCOME (decided = B): phone hero
   ============================================================ */
function EmailWelcome() {
  return (
    <Email>
      <div style={{ padding: '40px 44px 0', textAlign: 'center' }}>
        <Eyebrow style={{ marginBottom: 14 }}>Welcome to Digital Polyglot</Eyebrow>
        <Head size={40}>Tap a word.<br /><Gold>It clicks.</Gold></Head>
        <Lead>Your first short story is ready. Read it, tap any word for the meaning and native audio, and the language starts to make sense.</Lead>
      </div>
      <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', padding: '28px 0 4px' }}>
        <div style={{ position: 'absolute', top: 6, left: '50%', transform: 'translateX(-50%)',
          width: 360, height: 340, borderRadius: '50%', pointerEvents: 'none',
          background: 'radial-gradient(circle, rgba(252,211,77,0.16) 0%, rgba(125,211,252,0.10) 45%, transparent 70%)' }} />
        <div style={{ position: 'relative' }}>
          <PhoneFrame width={306}>
            <div style={{ padding: '42px 18px 22px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <span style={{ color: DPE.muted, fontSize: 20, fontWeight: 700, lineHeight: 1 }}>‹</span>
                <span style={{ fontWeight: 900, fontSize: 15.5, color: DPE.fg, marginLeft: 2 }}>Mole en San Ángel</span>
                <span style={{ marginLeft: 'auto' }}><Badge>A1</Badge></span>
              </div>
              <p style={{ margin: '0 0 16px', fontWeight: 700, fontSize: 16, lineHeight: 1.62, color: DPE.fg }}>
                Es jueves al mediodía. La <Hi>fonda</Hi> de San Ángel está abierta y huele a <Hi>mole</Hi>.
              </p>
              <VocabCard scale={0.92} />
              <div style={{ marginTop: 18 }}><AudioBar scale={0.92} play /></div>
            </div>
          </PhoneFrame>
        </div>
      </div>
      <div style={{ padding: '24px 44px 0', textAlign: 'center' }}>
        <CTA>Open your first story&nbsp;→</CTA>
        <div style={{ marginTop: 13, fontWeight: 700, fontSize: 12.5, color: DPE.muted }}>About 4 minutes · picked for your level</div>
      </div>
    </Email>
  );
}

/* ============================================================
   2 · ACTIVATION NUDGE  (+24h, first story unfinished)
   cover + % read
   ============================================================ */
function EmailNudge() {
  return (
    <Email>
      <div style={{ padding: '44px 44px 0', textAlign: 'center' }}>
        <Eyebrow color={DPE.sky} style={{ marginBottom: 14 }}>Pick up where you left off</Eyebrow>
        <Head size={37}>It clicks faster<br />than you <Gold>think.</Gold></Head>
        <Lead>Your first story takes about 4 minutes, and you are already partway in. Finish it and you will feel the difference.</Lead>
      </div>
      <div style={{ padding: '28px 44px 0' }}>
        <StoryCardH
          cover="assets/cover-es-mx.jpg"
          level="Beginner" meta="· 4 min · audio"
          title="Mole en San Ángel"
          teaser="Es jueves al mediodía. La fonda de San Ángel huele a mole."
          pct={38} pctLabel="38% read · about 2 min left" />
      </div>
      <div style={{ padding: '26px 44px 0', textAlign: 'center' }}>
        <CTA>Finish your first story&nbsp;→</CTA>
      </div>
    </Email>
  );
}

/* ============================================================
   3 · CELEBRATION  (on story_completed, 1st)
   stat chips: words · minutes
   ============================================================ */
function EmailCelebration() {
  return (
    <Email>
      <div style={{ padding: '44px 44px 0', textAlign: 'center' }}>
        <div style={{ width: 60, height: 60, borderRadius: '50%', margin: '0 auto 20px',
          background: 'linear-gradient(135deg,#fcd34d,#f4c430)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 14px 30px -10px rgba(252,211,77,0.6)' }}>
          <span style={{ color: DPE.goldInk, fontSize: 30, fontWeight: 900 }}>✓</span>
        </div>
        <Eyebrow style={{ marginBottom: 14 }}>First story complete</Eyebrow>
        <Head size={40}>That's how<br />it <Gold>works.</Gold></Head>
        <Lead>You just finished your first story. Those words you tapped are already starting to stick. Now keep the thread going.</Lead>
      </div>
      <div style={{ display: 'flex', gap: 12, padding: '26px 44px 0', justifyContent: 'center' }}>
        <StatChip n="47" label="new words seen" />
        <StatChip n="4 min" label="of reading" />
      </div>
      <div style={{ padding: '26px 44px 0', textAlign: 'center' }}>
        <CTA>Read your next story&nbsp;→</CTA>
      </div>
    </Email>
  );
}

/* ============================================================
   4 · HOW IT WORKS  (day 3, educational) — tip: tap a word
   ============================================================ */
function EmailHowItWorks() {
  return (
    <Email>
      <div style={{ padding: '44px 44px 0', textAlign: 'center' }}>
        <Eyebrow color={DPE.sky} style={{ marginBottom: 14 }}>Why it works</Eyebrow>
        <Head size={36}>Words stick when<br />they live in a <Gold>story.</Gold></Head>
        <Lead>Lists make you memorize. Stories make you remember. See a word inside a scene, tap it once, and it lands where it belongs.</Lead>
      </div>
      <div style={{ padding: '28px 44px 0' }}>
        <div style={{ background: DPE.screen, borderRadius: 18, border: `1px solid ${DPE.cardLine}`,
          padding: '22px 22px 24px', boxShadow: '0 20px 44px -22px rgba(0,0,0,0.7)' }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 19, lineHeight: 1.5, color: DPE.fg, textAlign: 'center' }}>
            La <Hi>fonda</Hi> de San Ángel huele a mole.
          </p>
          <div style={{ marginTop: 18, maxWidth: 300, marginLeft: 'auto', marginRight: 'auto' }}>
            <VocabCard />
          </div>
          <div style={{ marginTop: 16, fontWeight: 700, fontSize: 12.5, color: DPE.muted, textAlign: 'center' }}>
            Tap once. Meaning, audio and a save button, without leaving the story.
          </div>
        </div>
      </div>
      <div style={{ padding: '26px 44px 0', textAlign: 'center' }}>
        <CTA>Try it on a new story&nbsp;→</CTA>
      </div>
    </Email>
  );
}

/* ============================================================
   5 · WEEKLY RECAP  (day 7) — stats block (key visual)
   ============================================================ */
function EmailRecap() {
  const days = [1, 1, 0, 1, 1, 1, 0]; // active days this week
  return (
    <Email>
      <div style={{ padding: '44px 44px 0', textAlign: 'center' }}>
        <Eyebrow style={{ marginBottom: 14 }}>Your first week</Eyebrow>
        <Head size={38}>Look how far<br />you've <Gold>come.</Gold></Head>
        <Lead>Seven days in. Here is the week you just put together, one story at a time.</Lead>
      </div>
      <div style={{ display: 'flex', gap: 12, padding: '28px 44px 0' }}>
        <StatTile n="3" label="stories" tone="gold" />
        <StatTile n="128" label="words" tone="sky" />
        <StatTile n="5" label="days active" tone="green" />
      </div>
      {/* 7-day rhythm row */}
      <div style={{ padding: '18px 44px 0' }}>
        <div style={{ background: DPE.screen, border: `1px solid ${DPE.cardLine}`, borderRadius: 14,
          padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontWeight: 800, fontSize: 11.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: DPE.muted }}>This week</span>
            <span style={{ fontWeight: 800, fontSize: 12, color: DPE.gold }}>5 of 7 days</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {days.map((on, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }}>
                <div style={{ width: '100%', height: 30, borderRadius: 7,
                  background: on ? 'linear-gradient(180deg,#fcd34d,#f4c430)' : 'rgba(125,211,252,0.10)',
                  boxShadow: on ? '0 6px 14px -8px rgba(252,211,77,0.7)' : 'none' }} />
                <span style={{ fontWeight: 700, fontSize: 10.5, color: DPE.faint }}>{'MTWTFSS'[i]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{ padding: '24px 44px 0', textAlign: 'center' }}>
        <CTA>Keep your rhythm&nbsp;→</CTA>
      </div>
    </Email>
  );
}

/* ============================================================
   6 · NEXT STORY / IDENTITY  (day 10-14) — 2-3 story cards
   ============================================================ */
function EmailNext() {
  return (
    <Email>
      <div style={{ padding: '44px 44px 0', textAlign: 'center' }}>
        <Eyebrow color={DPE.sky} style={{ marginBottom: 14 }}>You're becoming a reader</Eyebrow>
        <Head size={37}>A few stories down.<br /><Gold>Many to go.</Gold></Head>
        <Lead>You are reading in a new language now. Here are three more, picked for where you are.</Lead>
      </div>
      <div style={{ display: 'flex', gap: 12, padding: '28px 40px 0' }}>
        <StoryCardV cover="assets/cover-es-es.jpg" level="A2" meta="· 5 min" title="El metro de Madrid" />
        <StoryCardV cover="assets/cover-es-arg.jpg" level="A2" meta="· 4 min" title="Un mate en Palermo" />
        <StoryCardV cover="assets/cover-de-de.jpg" level="A1" meta="· 6 min" title="Kaffee in Kreuzberg" />
      </div>
      <div style={{ padding: '28px 44px 0', textAlign: 'center' }}>
        <CTA>Choose your next story&nbsp;→</CTA>
      </div>
    </Email>
  );
}

/* ============================================================
   7a · WIN-BACK · Reminder  (inactive 30-45d)
   ============================================================ */
function EmailWinReminder() {
  return (
    <Email footerNote="You haven't read in a while, so we're checking in.">
      <div style={{ padding: '46px 44px 0', textAlign: 'center' }}>
        <Eyebrow color={DPE.sky} style={{ marginBottom: 14 }}>It's been a little while</Eyebrow>
        <Head size={38}>Your stories are<br /><Gold>still here.</Gold></Head>
        <Lead>Your library, your saved words and your progress are waiting exactly where you left them.</Lead>
      </div>
      {/* quiet library row */}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', padding: '30px 44px 0', opacity: 0.85 }}>
        {['assets/cover-es-mx.jpg', 'assets/cover-es-es.jpg', 'assets/cover-de-de.jpg'].map((c, i) => (
          <img key={i} src={c} alt="" style={{ width: 96, height: 132, objectFit: 'cover', borderRadius: 12,
            boxShadow: '0 14px 28px -14px rgba(0,0,0,0.8)' }} />
        ))}
      </div>
      <div style={{ padding: '30px 44px 0', textAlign: 'center' }}>
        <CTA>Open your library&nbsp;→</CTA>
      </div>
    </Email>
  );
}

/* ============================================================
   7b · WIN-BACK · Value  (showcase new stories)
   ============================================================ */
function EmailWinValue() {
  return (
    <Email footerNote="A quick note about what's new since your last visit.">
      <div style={{ padding: '46px 44px 0', textAlign: 'center' }}>
        <Eyebrow style={{ marginBottom: 14 }}>New since you've been gone</Eyebrow>
        <Head size={37}>Fresh stories,<br />your <Gold>language.</Gold></Head>
        <Lead>We have been busy. New short stories at your level, ready when you are.</Lead>
      </div>
      <div style={{ display: 'flex', gap: 12, padding: '28px 44px 0' }}>
        <StoryCardV cover="assets/cover-es-arg.jpg" level="A2" meta="· 5 min" title="Un mate en Palermo" badge="New" />
        <StoryCardV cover="assets/cover-es-es.jpg" level="A2" meta="· 4 min" title="El metro de Madrid" badge="New" />
      </div>
      <div style={{ padding: '28px 44px 0', textAlign: 'center' }}>
        <CTA>See what's new&nbsp;→</CTA>
      </div>
    </Email>
  );
}

/* ============================================================
   7c · WIN-BACK · Sunset  (human, low pressure)
   ============================================================ */
function EmailWinSunset() {
  return (
    <Email footerNote="This is the last email in this series.">
      <div style={{ padding: '54px 44px 0', textAlign: 'center' }}>
        <div style={{ margin: '0 auto 22px' }}><span style={{ display: 'inline-block' }}><Mark size={44} radius={13} /></span></div>
        <Eyebrow color={DPE.muted} style={{ marginBottom: 14 }}>One last note</Eyebrow>
        <Head size={36}>We'll <Gold>stop here.</Gold></Head>
        <Lead>We don't want to crowd your inbox, so we'll pause these emails. Your stories and saved words stay saved, always. Come back whenever you like.</Lead>
      </div>
      <div style={{ padding: '32px 44px 0', textAlign: 'center' }}>
        <CTA>Keep me in&nbsp;→</CTA>
        <div style={{ marginTop: 14, fontWeight: 700, fontSize: 12.5, color: DPE.muted }}>
          Or do nothing, and we'll quietly step back.
        </div>
      </div>
    </Email>
  );
}

Object.assign(window, {
  EmailWelcome, EmailNudge, EmailCelebration, EmailHowItWorks, EmailRecap,
  EmailNext, EmailWinReminder, EmailWinValue, EmailWinSunset,
});
