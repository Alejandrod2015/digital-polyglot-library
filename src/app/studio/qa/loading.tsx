import StudioShell from "@/components/studio/StudioShell";

export default function QALoading() {
  return (
    <StudioShell title="QA" description="Cargando reporte de auditoría...">
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", gap: 12 }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="studio-skeleton" style={{ height: 80, flex: 1 }} />
          ))}
        </div>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="studio-skeleton" style={{ height: 56 }} />
        ))}
      </div>
    </StudioShell>
  );
}
