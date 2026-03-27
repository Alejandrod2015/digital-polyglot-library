import StudioShell from "@/components/studio/StudioShell";

export default function StudioLoading() {
  return (
    <StudioShell title="Loading..." description="Preparing the section">
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="studio-skeleton" style={{ height: 72 }} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="studio-skeleton" style={{ height: 110 }} />
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="studio-skeleton" style={{ height: 80 }} />
          ))}
        </div>
      </div>
    </StudioShell>
  );
}
