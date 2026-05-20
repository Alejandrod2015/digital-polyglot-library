import Link from "next/link";
import StudioShell from "@/components/studio/StudioShell";
import { prisma } from "@/lib/prisma";
import { requireStudioUser } from "@/lib/requireStudioUser";

export const dynamic = "force-dynamic";

/**
 * Studio dashboard for the curated practice sets. Lists every
 * JourneyStory that has text + vocab so editors can see at a glance:
 *   - which ones already have a persisted set (mobile reads it)
 *   - which sets are locked (approved)
 *   - which exercises still lack a pre-rendered audio URL
 * And jump straight into the per-story editor.
 */
export default async function PracticeSetsListPage() {
  await requireStudioUser("/studio/practice-sets");

  const stories = await prisma.journeyStory.findMany({
    where: { status: "published" },
    select: {
      id: true,
      slug: true,
      title: true,
      level: true,
      topic: true,
      journey: { select: { language: true, variant: true } },
      practiceSet: {
        select: {
          locked: true,
          updatedAt: true,
          exercises: { select: { id: true, audioUrl: true } },
        },
      },
    },
    orderBy: [{ journeyId: "asc" }, { level: "asc" }, { slotIndex: "asc" }],
  });

  // Group by language → level so the user can scan the journey quickly.
  const byLanguage = new Map<
    string,
    { level: string; rows: typeof stories }[]
  >();
  for (const s of stories) {
    const lang = s.journey.language || "?";
    const levelKey = s.level || "?";
    let langGroups = byLanguage.get(lang);
    if (!langGroups) {
      langGroups = [];
      byLanguage.set(lang, langGroups);
    }
    let levelGroup = langGroups.find((g) => g.level === levelKey);
    if (!levelGroup) {
      levelGroup = { level: levelKey, rows: [] };
      langGroups.push(levelGroup);
    }
    levelGroup.rows.push(s);
  }

  const total = stories.length;
  const withSet = stories.filter((s) => s.practiceSet).length;
  const locked = stories.filter((s) => s.practiceSet?.locked).length;
  const withAllAudio = stories.filter(
    (s) =>
      s.practiceSet &&
      s.practiceSet.exercises.length > 0 &&
      s.practiceSet.exercises.every((e) => !!e.audioUrl)
  ).length;

  return (
    <StudioShell
      title="Sets de práctica"
      description="Estado del set de ejercicios persistido para cada historia. Edita uno a uno o regenera desde el builder."
      breadcrumbs={[
        { label: "Studio", href: "/studio" },
        { label: "Sets de práctica" },
      ]}
    >
      <div style={shell}>
        <div style={statsRow}>
          <Stat label="Historias" value={total} />
          <Stat label="Con set" value={`${withSet} / ${total}`} accent={withSet === total ? "green" : "amber"} />
          <Stat label="Aprobados" value={`${locked} / ${withSet}`} accent={locked === withSet && withSet > 0 ? "green" : "neutral"} />
          <Stat label="Con audio pre-rendido" value={`${withAllAudio} / ${withSet}`} accent={withAllAudio === withSet && withSet > 0 ? "green" : "neutral"} />
        </div>

        {Array.from(byLanguage.entries())
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([lang, levelGroups]) => (
            <section key={lang} style={langSection}>
              <h2 style={langTitle}>{cap(lang)}</h2>
              {levelGroups
                .sort((a, b) => a.level.localeCompare(b.level))
                .map((group) => (
                  <div key={group.level} style={{ marginBottom: 20 }}>
                    <h3 style={levelTitle}>{group.level}</h3>
                    <div style={tableWrap}>
                      <div style={tableHeader}>
                        <div style={{ ...colTitle, flex: 1 }}>Historia</div>
                        <div style={colTitle}>Topic</div>
                        <div style={colTitle}>Set</div>
                        <div style={colTitle}>Audio</div>
                        <div style={{ ...colTitle, width: 80, textAlign: "right" }}></div>
                      </div>
                      {group.rows.map((s) => {
                        const set = s.practiceSet;
                        const exCount = set?.exercises.length ?? 0;
                        const audioCount = set?.exercises.filter((e) => !!e.audioUrl).length ?? 0;
                        return (
                          <div key={s.id} style={tableRow}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={titleCell}>{s.title ?? s.slug}</div>
                              <div style={slugCell}>{s.slug}</div>
                            </div>
                            <div style={topicCell}>{s.topic ?? "—"}</div>
                            <div>
                              {set ? (
                                <Pill
                                  text={set.locked ? `🔒 ${exCount}` : `${exCount}`}
                                  tone={set.locked ? "green" : "blue"}
                                />
                              ) : (
                                <Pill text="—" tone="muted" />
                              )}
                            </div>
                            <div>
                              {set ? (
                                <Pill
                                  text={`${audioCount}/${exCount}`}
                                  tone={audioCount === exCount && exCount > 0 ? "green" : audioCount === 0 ? "muted" : "amber"}
                                />
                              ) : (
                                <Pill text="—" tone="muted" />
                              )}
                            </div>
                            <div style={{ width: 80, textAlign: "right" }}>
                              <Link
                                href={`/studio/journey-stories/${s.id}/practice`}
                                style={editLink}
                              >
                                Editar →
                              </Link>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
            </section>
          ))}
      </div>
    </StudioShell>
  );
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function Stat({ label, value, accent = "neutral" }: { label: string; value: string | number; accent?: "neutral" | "amber" | "green" }) {
  const color = accent === "green" ? "#22c55e" : accent === "amber" ? "#f59e0b" : "#e5edf7";
  return (
    <div style={statCard}>
      <div style={{ color: "#94a3b8", fontSize: 11, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase" }}>{label}</div>
      <div style={{ color, fontSize: 22, fontWeight: 800, marginTop: 2 }}>{value}</div>
    </div>
  );
}

function Pill({ text, tone }: { text: string; tone: "green" | "blue" | "amber" | "muted" }) {
  const palette: Record<typeof tone, { bg: string; fg: string }> = {
    green: { bg: "rgba(34,197,94,0.12)", fg: "#22c55e" },
    blue: { bg: "rgba(59,130,246,0.12)", fg: "#60a5fa" },
    amber: { bg: "rgba(245,158,11,0.12)", fg: "#f59e0b" },
    muted: { bg: "rgba(148,163,184,0.10)", fg: "#94a3b8" },
  };
  const { bg, fg } = palette[tone];
  return (
    <span style={{
      display: "inline-block",
      background: bg,
      color: fg,
      padding: "3px 10px",
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 600,
      minWidth: 28,
      textAlign: "center",
    }}>{text}</span>
  );
}

const shell: React.CSSProperties = { maxWidth: 1100, margin: "0 auto", padding: "20px 16px 64px", color: "#e5edf7" };
const statsRow: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12, marginBottom: 24 };
const statCard: React.CSSProperties = { background: "#0f1e34", border: "1px solid rgba(148,163,184,0.18)", borderRadius: 10, padding: "12px 14px" };
const langSection: React.CSSProperties = { marginBottom: 32 };
const langTitle: React.CSSProperties = { fontSize: 18, fontWeight: 800, color: "#facc15", marginBottom: 14, paddingBottom: 6, borderBottom: "1px solid rgba(148,163,184,0.2)" };
const levelTitle: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: "#94a3b8", marginBottom: 8, letterSpacing: 0.5, textTransform: "uppercase" };
const tableWrap: React.CSSProperties = { background: "#0f1e34", border: "1px solid rgba(148,163,184,0.18)", borderRadius: 10, overflow: "hidden" };
const tableHeader: React.CSSProperties = { display: "flex", alignItems: "center", gap: 16, padding: "10px 14px", background: "rgba(148,163,184,0.06)", borderBottom: "1px solid rgba(148,163,184,0.18)" };
const tableRow: React.CSSProperties = { display: "flex", alignItems: "center", gap: 16, padding: "12px 14px", borderBottom: "1px solid rgba(148,163,184,0.10)" };
const colTitle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5, width: 96 };
const titleCell: React.CSSProperties = { fontWeight: 600, fontSize: 14, color: "#e5edf7", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
const slugCell: React.CSSProperties = { fontSize: 11, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
const topicCell: React.CSSProperties = { color: "#94a3b8", fontSize: 12, width: 96 };
const editLink: React.CSSProperties = { color: "#60a5fa", fontSize: 13, textDecoration: "none", fontWeight: 600 };
