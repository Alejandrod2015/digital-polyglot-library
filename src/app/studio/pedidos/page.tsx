// Pedidos de Shopify por origen. Lee dp_shopify_orders_v1, que escribe el
// webhook de pedidos. Sirve para comparar lo que Meta dice que vendio con lo
// que de verdad llego de cada canal, sin abrir los pedidos uno por uno.

import { requireStudioUser } from "@/lib/requireStudioUser";
import StudioShell from "@/components/studio/StudioShell";
import { prisma } from "@/lib/prisma";
import { CHANNEL_LABELS, type OrderChannel } from "@/lib/shopifyOrderAttribution";

export const dynamic = "force-dynamic";

function countryFlag(code: string | null): string {
  if (!code || code.length !== 2) return "";
  return code
    .toUpperCase()
    .split("")
    .map((c) => String.fromCodePoint(127397 + c.charCodeAt(0)))
    .join("");
}

function eur(value: number): string {
  return value.toLocaleString("es-ES", { style: "currency", currency: "EUR" });
}

function label(channel: string): string {
  return CHANNEL_LABELS[channel as OrderChannel] ?? channel;
}

async function loadData(days: number) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const where = { orderedAt: { gte: since } };
  const [recent, byChannel, byCampaign, firstOrder] = await Promise.all([
    prisma.shopifyOrder.findMany({ where, orderBy: { orderedAt: "desc" }, take: 300 }),
    prisma.shopifyOrder.groupBy({
      by: ["channel"],
      where,
      _count: { _all: true },
      _sum: { totalShop: true },
    }),
    prisma.shopifyOrder.groupBy({
      by: ["utmCampaign", "utmContent"],
      where: { ...where, channel: "meta_paid" },
      _count: { _all: true },
      _sum: { totalShop: true },
    }),
    prisma.shopifyOrder.findFirst({ orderBy: { orderedAt: "asc" }, select: { orderedAt: true } }),
  ]);
  return { recent, byChannel, byCampaign, firstOrder };
}

export default async function StudioPedidosPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  await requireStudioUser("/studio/pedidos");
  const { days: daysRaw } = await searchParams;
  const days = Math.max(1, Math.min(365, Number(daysRaw) || 7));

  let data: Awaited<ReturnType<typeof loadData>> | null = null;
  let tableMissing = false;
  try {
    data = await loadData(days);
  } catch (err) {
    console.error("pedidos load failed", err);
    tableMissing = true;
  }

  const totalOrders = data?.byChannel.reduce((n, r) => n + r._count._all, 0) ?? 0;
  const totalEur = data?.byChannel.reduce((n, r) => n + Number(r._sum.totalShop ?? 0), 0) ?? 0;
  const channels = [...(data?.byChannel ?? [])].sort((a, b) => b._count._all - a._count._all);
  const campaigns = [...(data?.byCampaign ?? [])].sort((a, b) => b._count._all - a._count._all);

  return (
    <StudioShell
      title="Pedidos por origen"
      description="Pedidos de Shopify con el origen que trae cada uno (UTM, referrer y primera pagina). Importes en la moneda de la tienda."
      breadcrumbs={[{ label: "Studio", href: "/studio" }, { label: "Pedidos por origen" }]}
    >
      {tableMissing ? (
        <div style={{ padding: 16, border: "1px solid #c2410c", borderRadius: 8, background: "#fff7ed", color: "#9a3412" }}>
          La tabla <code>dp_shopify_orders_v1</code> no existe todavia. Se crea con
          el SQL de <code>prisma/migrations/20260914200000_add_shopify_orders</code>.
        </div>
      ) : data ? (
        <div style={{ display: "grid", gap: 24 }}>
          <nav style={{ display: "flex", gap: 8, fontSize: 13, flexWrap: "wrap" }}>
            {[1, 7, 30, 90].map((d) => (
              <a
                key={d}
                href={`/studio/pedidos?days=${d}`}
                style={{
                  padding: "4px 10px",
                  borderRadius: 999,
                  border: "1px solid var(--mx-border, #d4d4d8)",
                  background: d === days ? "var(--mx-accent, #fcd34d)" : "transparent",
                  color: d === days ? "#16110d" : "inherit",
                  textDecoration: "none",
                  fontWeight: d === days ? 700 : 500,
                }}
              >
                {d === 1 ? "24 h" : `${d} dias`}
              </a>
            ))}
            {data.firstOrder ? (
              <span style={{ color: "#6b7280", alignSelf: "center" }}>
                Registrando desde {data.firstOrder.orderedAt.toLocaleDateString("es-ES")}. Los pedidos anteriores no estan.
              </span>
            ) : null}
          </nav>

          <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
            <Card title={`Por canal · ${totalOrders} pedidos · ${eur(totalEur)}`}>
              {channels.length === 0 ? <Empty /> : channels.map((r) => (
                <Row
                  key={r.channel}
                  left={label(r.channel)}
                  right={`${r._count._all} · ${eur(Number(r._sum.totalShop ?? 0))}`}
                />
              ))}
            </Card>
            <Card title="Meta de pago por campaña y anuncio">
              {campaigns.length === 0 ? <Empty /> : campaigns.map((r, i) => (
                <Row
                  key={`${r.utmCampaign ?? "-"}-${r.utmContent ?? "-"}-${i}`}
                  left={`${r.utmCampaign ?? "(sin campaña)"}${r.utmContent ? ` · ${r.utmContent}` : ""}`}
                  right={`${r._count._all} · ${eur(Number(r._sum.totalShop ?? 0))}`}
                />
              ))}
            </Card>
          </section>

          <section>
            <h2 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 8px" }}>Pedidos</h2>
            <div style={{ overflowX: "auto", border: "1px solid var(--mx-border, #e5e7eb)", borderRadius: 8 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "var(--mx-row-alt)", textAlign: "left" }}>
                    <Th>Pedido</Th>
                    <Th>Fecha</Th>
                    <Th>Total</Th>
                    <Th>Canal</Th>
                    <Th>Source / Medium · Campaign</Th>
                    <Th>Referrer</Th>
                    <Th>Primera pagina</Th>
                    <Th>Pais</Th>
                    <Th>Productos</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent.map((r) => (
                    <tr key={r.id} style={{ borderTop: "1px solid var(--mx-border, #e5e7eb)" }}>
                      <Td mono>{r.name}</Td>
                      <Td mono>{r.orderedAt.toLocaleString("es-ES")}</Td>
                      <Td mono>{eur(Number(r.totalShop))}</Td>
                      <Td>{label(r.channel)}</Td>
                      <Td>
                        {r.utmSource
                          ? `${r.utmSource} / ${r.utmMedium ?? "-"}${r.utmCampaign ? ` · ${r.utmCampaign}` : ""}`
                          : r.hasFbclid ? "(fbclid)" : "-"}
                      </Td>
                      <Td mono>{r.referringSite ?? "-"}</Td>
                      <Td mono>{r.landingSite ? r.landingSite.split("?")[0] : "-"}</Td>
                      <Td>{countryFlag(r.country)} {r.country ?? "?"}</Td>
                      <Td>{r.items.join(", ")}</Td>
                    </tr>
                  ))}
                  {data.recent.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ padding: 24, textAlign: "center", color: "#6b7280" }}>
                        Ningun pedido registrado en este periodo.
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

function Row({ left, right }: { left: string; right: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{left}</span>
      <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600, whiteSpace: "nowrap" }}>{right}</span>
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
