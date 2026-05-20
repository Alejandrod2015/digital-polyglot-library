/* global React, Icon */

// ---------- Topic palette (iPhone TOPIC_PANEL_PALETTE) ----------
const TOPIC_PALETTE = [
  "#1f7ee0", // blue
  "#58a700", // green
  "#a560e8", // purple
  "#ff9600", // orange
  "#ff4b4b", // red
  "#00b894", // teal
  "#e17055", // terracotta
  "#5dd9e8", // cyan
  "#f5b942", // amber
  "#ff8aa8", // pink
];
const colorForTopic = (i) => TOPIC_PALETTE[i % TOPIC_PALETTE.length];

// ---------- Top bar (language pill + stats) ----------
const JourneyTopBar = ({ language }) => (
  <header className="j-topbar">
    <button className="j-lang-pill">
      <span className="flag">{language.flag}</span>
      <span className="code">{language.code}</span>
      <span className="chev">▾</span>
    </button>
    <div className="j-top-stats">
      <span className="j-stat energy"><span className="ico">⚡</span>8</span>
      <span className="j-stat level"><span className="ico">🏆</span>Lv 7</span>
      <span className="j-stat stars"><span className="ico">⭐</span>1.4k</span>
    </div>
  </header>
);

// ---------- Topic banner (LEVEL A1 · Food & Drink) ----------
const TopicBanner = ({ topic, color, locked, levelId }) => (
  <div
    className={`j-topic-banner ${locked ? "locked" : ""}`}
    style={{ "--tp-color": locked ? "#3b4a66" : color }}
  >
    <div className="copy">
      <span className="eyebrow">Level {levelId}{locked && " · Locked"}</span>
      <span className="title">{topic.title}</span>
    </div>
    <button className="list-btn" aria-label="Topic stories">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 6h12M8 12h12M8 18h12"/>
        <circle cx="4" cy="6" r="1" fill="currentColor"/>
        <circle cx="4" cy="12" r="1" fill="currentColor"/>
        <circle cx="4" cy="18" r="1" fill="currentColor"/>
      </svg>
    </button>
  </div>
);

// ---------- Story card (image + title + check circle) ----------
const StoryCard = ({ story, color, active }) => {
  const checkIcon = {
    done:      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
    next:      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
    available: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
    locked:    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>,
  }[story.state];

  return (
    <button
      className={`j-story-card ${story.state} ${active ? "active" : ""}`}
      style={{ "--tp-color": color }}
      disabled={story.state === "locked"}
    >
      <div className="thumb" style={{
        background: `linear-gradient(135deg, ${color} 0%, ${color}aa 50%, ${color}55 100%)`,
      }}>
        <span>{story.icon || "📖"}</span>
      </div>
      <span className="title">{story.title}</span>
      <span className="check">{checkIcon}</span>
    </button>
  );
};

// ---------- Topic block (banner + zigzag story cards + checkpoint) ----------
const TopicBlock = ({ topic, color, locked, levelId }) => {
  // Stronger zigzag: alternating offsets with subtle wave
  const offsetAt = (i, total) => {
    if (total <= 1) return 30;
    // alternate: 0, 80, 30, 100, 50, 70, 20 ... (zigzag-ish)
    const pattern = [0, 90, 35, 120, 60, 100, 25, 80, 45];
    return pattern[i % pattern.length];
  };

  const total = topic.stories.length;

  return (
    <section className="j-topic-block">
      <TopicBanner topic={topic} color={color} locked={locked} levelId={levelId}/>
      {topic.stories.map((story, i) => (
        <div
          key={i}
          className="j-story-row"
          style={{ "--wave-offset": `${offsetAt(i, total)}px` }}
        >
          <StoryCard
            story={locked ? { ...story, state: "locked" } : story}
            color={color}
            active={story.state === "next" && !locked}
          />
        </div>
      ))}
    </section>
  );
};

window.JourneyTopBar = JourneyTopBar;
window.TopicBlock = TopicBlock;
window.TOPIC_PALETTE = TOPIC_PALETTE;
window.colorForTopic = colorForTopic;
