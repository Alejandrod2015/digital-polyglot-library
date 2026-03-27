import StudioShell from "@/components/studio/StudioShell";

export default function JourneyStoriesLoading() {
  return (
    <StudioShell
      title="Journey Stories"
      description="Loading stories, gaps, and editor actions..."
    >
      <div style={{ display: "grid", gap: 16 }}>
        <div style={{ height: 88, borderRadius: 12, background: "var(--card-bg)", border: "1px solid var(--card-border)", opacity: 0.7 }} />
        <div style={{ height: 180, borderRadius: 12, background: "var(--card-bg)", border: "1px solid var(--card-border)", opacity: 0.55 }} />
        <div style={{ height: 240, borderRadius: 12, background: "var(--card-bg)", border: "1px solid var(--card-border)", opacity: 0.4 }} />
      </div>
    </StudioShell>
  );
}
