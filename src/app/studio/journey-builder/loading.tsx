import StudioShell from "@/components/studio/StudioShell";

export default function JourneyBuilderLoading() {
  return (
    <StudioShell
      title="Creador de Journeys"
      description="Cargando variantes y estructura del journey..."
    >
      <div style={{ display: "grid", gap: 16 }}>
        <div style={{ height: 88, borderRadius: 12, background: "var(--card-bg)", border: "1px solid var(--card-border)", opacity: 0.7 }} />
        <div style={{ height: 200, borderRadius: 12, background: "var(--card-bg)", border: "1px solid var(--card-border)", opacity: 0.55 }} />
        <div style={{ height: 200, borderRadius: 12, background: "var(--card-bg)", border: "1px solid var(--card-border)", opacity: 0.4 }} />
      </div>
    </StudioShell>
  );
}
