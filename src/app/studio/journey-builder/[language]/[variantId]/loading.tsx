import StudioShell from "@/components/studio/StudioShell";

export default function JourneyVariantBuilderLoading() {
  return (
    <StudioShell
      title="Estructura del Journey"
      description="Cargando este journey..."
    >
      <div style={{ display: "grid", gap: 16 }}>
        <div style={{ height: 64, borderRadius: 12, background: "var(--card-bg)", border: "1px solid var(--card-border)", opacity: 0.7 }} />
        <div style={{ height: 460, borderRadius: 12, background: "var(--card-bg)", border: "1px solid var(--card-border)", opacity: 0.45 }} />
      </div>
    </StudioShell>
  );
}
