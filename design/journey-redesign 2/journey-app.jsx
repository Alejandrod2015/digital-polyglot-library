/* global React, Sidebar, JourneyTopBar, TopicBlock, colorForTopic,
          useTweaks, TweaksPanel, TweakSection, TweakRadio */

const { useState, useEffect } = React;

// ---------- Curriculum data ----------
const LANGUAGE = { code: "ES", flag: "🇪🇸" };

// Flat sequence of topics across A1 + A2. Each carries its own levelId
// so the banner can stamp "LEVEL A1" / "LEVEL A2" automatically.
const TOPICS = [
  {
    slug: "food-and-drink",
    levelId: "A1",
    title: "Food & Drink",
    icon: "🍳",
    checkpointStatus: "ready",
    locked: false,
    stories: [
      { title: "Desayuno en la finca",        icon: "☕", state: "done" },
      { title: "El mercado de Medellín",      icon: "🥭", state: "done" },
      { title: "Café con la abuela",          icon: "👵", state: "done" },
      { title: "Una arepa para llevar",       icon: "🌽", state: "next" },
      { title: "Almuerzo con los vecinos",    icon: "🍲", state: "available" },
      { title: "La cena del domingo",         icon: "🍷", state: "available" },
      { title: "Pidiendo en el restaurante",  icon: "🍽️", state: "available" },
    ],
  },
  {
    slug: "home-and-family",
    levelId: "A1",
    title: "Home & Family",
    icon: "🏡",
    checkpointStatus: "locked",
    locked: false,
    stories: [
      { title: "La casa de la abuela",   icon: "🏠", state: "available" },
      { title: "Una mañana en familia",  icon: "👨‍👩‍👧", state: "available" },
      { title: "El cumpleaños de papá",  icon: "🎂", state: "available" },
      { title: "Mi hermana pequeña",     icon: "👧", state: "available" },
    ],
  },
  {
    slug: "meeting-new-people",
    levelId: "A1",
    title: "Meeting New People",
    icon: "👋",
    checkpointStatus: "locked",
    locked: false,
    stories: [
      { title: "Un nuevo amigo en el bus", icon: "🚌", state: "available" },
      { title: "El primer día de clase",    icon: "🎒", state: "available" },
      { title: "Conociendo al vecino",       icon: "🚪", state: "available" },
    ],
  },
  {
    slug: "airport-and-transit",
    levelId: "A1",
    title: "Airport & Transit",
    icon: "✈️",
    checkpointStatus: "locked",
    locked: false,
    stories: [
      { title: "Llegada a Bogotá",        icon: "🛬", state: "available" },
      { title: "El bondi de medianoche",  icon: "🚍", state: "available" },
      { title: "Perdido en el aeropuerto", icon: "🧳", state: "available" },
    ],
  },
  {
    slug: "work-and-money",
    levelId: "A2",
    title: "Work & Money",
    icon: "💼",
    checkpointStatus: "locked",
    locked: true,
    stories: [
      { title: "Mi primer trabajo", icon: "💼", state: "locked" },
      { title: "La entrevista",      icon: "🤝", state: "locked" },
      { title: "En el banco",        icon: "🏦", state: "locked" },
    ],
  },
  {
    slug: "culture-and-traditions",
    levelId: "A2",
    title: "Culture & Traditions",
    icon: "🎉",
    checkpointStatus: "locked",
    locked: true,
    stories: [
      { title: "La feria de Cali",  icon: "🎊", state: "locked" },
      { title: "Día de muertos",     icon: "💀", state: "locked" },
    ],
  },
];

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "showLocked": true
}/*EDITMODE-END*/;

const App = () => {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  useEffect(() => { document.body.className = ""; }, []);

  const visibleTopics = t.showLocked ? TOPICS : TOPICS.filter(top => !top.locked);

  return (
    <div className="shell">
      <Sidebar active="journey"/>
      <main className="main">
        <JourneyTopBar language={LANGUAGE}/>

        {visibleTopics.map((topic, i) => (
          <TopicBlock
            key={topic.slug}
            topic={topic}
            color={colorForTopic(i)}
            locked={topic.locked}
            levelId={topic.levelId}
          />
        ))}
      </main>

      <TweaksPanel title="Tweaks">
        <TweakSection title="View">
          <TweakRadio label="Show locked topics" value={t.showLocked ? "yes" : "no"}
            onChange={v => setTweak("showLocked", v === "yes")}
            options={[
              { value: "yes", label: "Show" },
              { value: "no",  label: "Hide" },
            ]}/>
        </TweakSection>
      </TweaksPanel>
    </div>
  );
};

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
