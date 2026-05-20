/* global React */
const { useState } = React;

// ---------- Icons (Lucide-style line, 1.5 stroke) ----------
const Icon = ({ name, size = 18 }) => {
  const s = size;
  const props = {
    width: s, height: s, viewBox: "0 0 24 24",
    fill: "none", stroke: "currentColor", strokeWidth: 2,
    strokeLinecap: "round", strokeLinejoin: "round",
  };
  const paths = {
    home: <><path d="M3 12 12 4l9 8"/><path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9"/></>,
    map: <><path d="m3 6 6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v16M15 6v16"/></>,
    compass: <><circle cx="12" cy="12" r="9"/><path d="m16 8-2 6-6 2 2-6z"/></>,
    brain: <><path d="M12 5a3 3 0 0 0-3 3 3 3 0 0 0-3 3v2a3 3 0 0 0 3 3 3 3 0 0 0 3 3z"/><path d="M12 5a3 3 0 0 1 3 3 3 3 0 0 1 3 3v2a3 3 0 0 1-3 3 3 3 0 0 1-3 3z"/></>,
    library: <><rect x="4" y="4" width="5" height="16" rx="1"/><rect x="11" y="4" width="5" height="16" rx="1"/><path d="m18 5 2.5.6-3 14.3-2.5-.6z"/></>,
    star: <path d="m12 3 2.6 5.4 5.9.8-4.3 4.2 1 5.9L12 16.6 6.8 19.3l1-5.9L3.5 9.2l5.9-.8z"/>,
    chart: <><path d="M3 3v18h18"/><path d="M7 14v3"/><path d="M12 10v7"/><path d="M17 6v11"/></>,
    daily: <><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></>,
    crown: <><path d="M3 17h18l-2-10-5 4-3-7-3 7-5-4z"/><path d="M3 20h18"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9c.3.6.9 1 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></>,
    signout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></>,
    bell: <><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a2 2 0 0 0 3.4 0"/></>,
    chevronL: <path d="m15 18-6-6 6-6"/>,
    chevronR: <path d="m9 18 6-6-6-6"/>,
    play: <path d="M6 4.5 19 12 6 19.5z" fill="currentColor"/>,
    arrowR: <><path d="M5 12h14"/><path d="m13 5 7 7-7 7"/></>,
    plus: <><path d="M12 5v14"/><path d="M5 12h14"/></>,
    bookmark: <path d="M6 4h12v17l-6-4-6 4z"/>,
    flame: <path d="M12 22c4.5 0 8-3 8-8 0-4.5-3-7-5-9 0 2-2 3-3.5 3.5C9 9 6 11 6 14c0 5 3 8 6 8z"/>,
  };
  return <svg {...props}>{paths[name]}</svg>;
};

// ---------- Illustration placeholder ----------
const Illustration = ({ a, b, icon = "📖", label = "story art" }) => (
  <div className="placeholder" style={{ "--ph-a": a, "--ph-b": b }}>
    <div>
      <div className="ph-icon">{icon}</div>
      <div className="ph-label">{label}</div>
    </div>
  </div>
);

// ---------- Badges ----------
const Badge = ({ kind, children }) => (
  <span className={`badge ${kind}`}>{children}</span>
);

const LevelBadge = ({ level }) => {
  const map = { Beginner: "level-beg", Intermediate: "level-int", Advanced: "level-adv" };
  return <Badge kind={map[level]}>{level}</Badge>;
};

// ---------- Sidebar ----------
const Sidebar = ({ active = "home" }) => {
  const cls = (item) => `nav-item ${active === item ? "active" : ""}`;
  return (
  <aside className="sidebar">
    <div className="logo">
      <div className="logo-mark">dp</div>
      <div className="logo-text">
        <span className="l1">Digital</span>
        <span className="l2">Polyglot</span>
      </div>
    </div>

    <nav className="nav">
      <a className={cls("home")}><span className="icon"><Icon name="home" size={20}/></span><span>Home</span></a>
      <a className={cls("journey")}><span className="icon"><Icon name="map" size={20}/></span><span>Journey</span></a>
      <a className={cls("explore")}><span className="icon"><Icon name="compass" size={20}/></span><span>Explore</span></a>
      <a className={cls("review")}><span className="icon"><Icon name="brain" size={20}/></span><span>Review</span><span className="count">12</span></a>
      <a className={cls("library")}><span className="icon"><Icon name="library" size={20}/></span><span>My Library</span></a>
      <a className={cls("favorites")}><span className="icon"><Icon name="star" size={20}/></span><span>Favorites</span></a>
      <a className={cls("progress")}><span className="icon"><Icon name="chart" size={20}/></span><span>Progress</span></a>
      <a className={cls("daily")}><span className="icon"><Icon name="daily" size={20}/></span><span>Story of the Day</span></a>
      <a className={`${cls("upgrade")} upgrade`}><span className="icon"><Icon name="crown" size={20}/></span><span>Upgrade</span></a>
      <a className={cls("settings")}><span className="icon"><Icon name="settings" size={20}/></span><span>Settings</span></a>
    </nav>

    <div className="streak-card">
      <div className="label">Current streak</div>
      <div className="big"><span className="flame">🔥</span>14<span className="unit">days</span></div>
      <div className="sub">Keep it going — listen today</div>
      <div className="days">
        {[1,1,1,1,1,1,0].map((d, i) => <div key={i} className={`dot ${d ? "on" : ""}`}/>)}
      </div>
    </div>

    <div className="profile-row">
      <div className="avatar">A</div>
      <div className="meta">
        <span className="name">Alex</span>
        <span className="plan">basic</span>
      </div>
      <button className="out" title="Sign out"><Icon name="signout" size={16}/></button>
    </div>

    <div className="legal">
      <a href="#">Impressum</a>
      <a href="#">Privacy</a>
      <a href="#">Cookies</a>
      <a href="#">Terms</a>
      <a href="#">Data deletion</a>
    </div>
  </aside>
  );
};

window.Icon = Icon;
window.Illustration = Illustration;
window.Badge = Badge;
window.LevelBadge = LevelBadge;
window.Sidebar = Sidebar;
