// First-party visit log dashboard. Reads from dp_page_visits_v1 and
// shows the last 200 raw visits + lightweight aggregates (top
// countries, top sources, top paths) for the chosen window.

import { requireStudioUser } from "@/lib/requireStudioUser";
import StudioShell from "@/components/studio/StudioShell";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type VisitRow = {
  id: string;
  path: string;
  referrer: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  deviceCategory: string | null;
  browserLanguage: string | null;
  sessionId: string | null;
  createdAt: Date;
};

function countryFlag(code: string | null): string {
  if (!code || code.length !== 2) return "";
  return code
    .toUpperCase()
    .split("")
    .map((c) => String.fromCodePoint(127397 + c.charCodeAt(0)))
    .join("");
}

function shortHost(value: string | null): string {
  if (!value) return "";
  try {
    const u = new URL(value);
    return u.host + u.pathname;
  } catch {
    return value.slice(0, 60);
  }
}

function fmt(date: Date): string {
  return date.toLocaleString();
}

async function loadData(days: number) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const [recent, byCountry, bySource, byPath] = await Promise.all([
    prisma.pageVisit.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        path: true,
        referrer: true,
        utmSource: true,
        utmMedium: true,
        utmCampaign: true,
        country: true,
        region: true,
        city: true,
        deviceCategory: true,
        browserLanguage: true,
        sessionId: true,
        createdAt: true,
      },
    }),
    prisma.pageVisit.groupBy({
      by: ["country"],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
      orderBy: { _count: { country: "desc" } },
      take: 15,
    }),
    prisma.pageVisit.groupBy({
      by: ["utmSource", "utmMedium"],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
      orderBy: { _count: { utmSource: "desc" } },
      take: 15,
    }),
    prisma.pageVisit.groupBy({
      by: ["path"],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
      orderBy: { _count: { path: "desc" } },
      take: 15,
    }),
  ]);
  return { recent, byCountry, bySource, byPath };
}

export default async function StudioVisitsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  await requireStudioUser("/studio/visits");
  const { days: daysRaw } = await searchParams;
  const days = Math.max(1, Math.min(90, Number(daysRaw) || 7));

  let data: Awaited<ReturnType<typeof loadData>> | null = null;
  let tableMissing = false;
  try {
    data = await loadData(days);
  } catch (err) {
    // dp_page_visits_v1 isn't created yet. Tell the admin how to fix.
    console.error("visits load failed", err);
    tableMissing = true;
  }

  return (
    <StudioShell
      title="Page visits"
      description="First-party visit log. Server-side, no cookie consent required. Geo from Vercel edge headers."
      breadcrumbs={[
        { label: "Studio", href: "/studio" },
        { label: "Page visits" },
      ]}
    >
      {tableMissing ? (
        <div style={{ padding: 16, border: "1px solid #c2410c", borderRadius: 8, background: "#fff7ed", color: "#9a3412" }}>
          The <code>dp_page_visits_v1</code> table doesn&apos;t exist yet.
          POST <code>/api/studio/apply-pending-migrations</code> from an
          admin browser session to create it.
        </div>
      ) : data ? (
        <div style={{ display: "grid", gap: 24 }}>
          <nav style={{ display: "flex", gap: 8, fontSize: 13 }}>
            {[1, 7, 30, 90].map((d) => (
              <a
                key={d}
                href={`/studio/visits?days=${d}`}
                style={{
                  padding: "4px 10px",
                  borderRadius: 999,
                  border: "1px solid var(--mx-border, #d4d4d8)",
                  background: d === days ? "var(--mx-accent, #fcd34d)" : "transparent",
                  color: d === days ? "#0b1e36" : "inherit",
                  textDecoration: "none",
                  fontWeight: d === days ? 700 : 500,
                }}
              >
                {d === 1 ? "Today" : `${d}d`}
              </a>
            ))}
          </nav>

          <section style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 16 }}>
            <Card title="Top countries">
              {data.byCountry.length === 0 ? <Empty /> : data.byCountry.map((r) => (
                <Row key={r.country ?? "?"} left={`${countryFlag(r.country)} ${r.country ?? "?"}`} right={r._count._all} />
              ))}
            </Card>
            <Card title="Top sources">
              {data.bySource.length === 0 ? <Empty /> : data.bySource.map((r, i) => (
                <Row
                  key={`${r.utmSource ?? "direct"}-${r.utmMedium ?? "-"}-${i}`}
                  left={r.utmSource ? `${r.utmSource} / ${r.utmMedium ?? "-"}` : "(direct)"}
                  right={r._count._all}
                />
              ))}
            </Card>
            <Card title="Top pages">
              {data.byPath.length === 0 ? <Empty /> : data.byPath.map((r) => (
                <Row key={r.path} left={r.path} right={r._count._all} />
              ))}
            </Card>
          </section>

          <section>
            <h2 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 8px" }}>Recent visits</h2>
            <div style={{ overflowX: "auto", border: "1px solid var(--mx-border, #e5e7eb)", borderRadius: 8 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "var(--mx-row-alt, #f8fafc)", textAlign: "left" }}>
                    <Th>When</Th>
                    <Th>Path</Th>
                    <Th>From</Th>
                    <Th>Source / Med</Th>
                    <Th>Geo</Th>
                    <Th>Device</Th>
                    <Th>Lang</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent.map((r: VisitRow) => (
                    <tr key={r.id} style={{ borderTop: "1px solid var(--mx-border, #e5e7eb)" }}>
                      <Td mono>{fmt(r.createdAt)}</Td>
                      <Td mono>{r.path}</Td>
                      <Td mono>{shortHost(r.referrer)}</Td>
                      <Td>
                        {r.utmSource ? `${r.utmSource} / ${r.utmMedium ?? "-"}${r.utmCampaign ? ` · ${r.utmCampaign}` : ""}` : "(direct)"}
                      </Td>
                      <Td>
                        {countryFlag(r.country)} {[r.city, r.region, r.country].filter(Boolean).join(", ") || "?"}
                      </Td>
                      <Td>{r.deviceCategory ?? "?"}</Td>
                      <Td>{r.browserLanguage ?? "?"}</Td>
                    </tr>
                  ))}
                  {data.recent.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: 24, textAlign: "center", color: "#6b7280" }}>
                        No visits in the last {days} day{days === 1 ? "" : "s"} yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : null}
    </StudioShell>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: 12, border: "1px solid var(--mx-border, #e5e7eb)", borderRadius: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, color: "#6b7280", marginBottom: 8 }}>
        {title}
      </div>
      <div style={{ display: "grid", gap: 4, fontSize: 13 }}>{children}</div>
    </div>
  );
}

function Row({ left, right }: { left: string; right: number }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{left}</span>
      <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{right}</span>
    </div>
  );
}

function Empty() {
  return <span style={{ color: "#9ca3af", fontSize: 12 }}>-</span>;
}

function Th({ children }: { children: React.ReactNode }) {
  return <th style={{ padding: "6px 10px", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4, color: "#374151" }}>{children}</th>;
}

function Td({ children, mono }: { children: React.ReactNode; mono?: boolean }) {
  return <td style={{ padding: "6px 10px", fontFamily: mono ? "var(--font-jetbrains-mono), ui-monospace, monospace" : undefined, whiteSpace: "nowrap" }}>{children}</td>;
}
