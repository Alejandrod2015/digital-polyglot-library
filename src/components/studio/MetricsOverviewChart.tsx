"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Props = {
  data: Array<{
    date: string;
    plays: number;
    completions: number;
  }>;
};

export default function MetricsOverviewChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
        <XAxis dataKey="date" tick={{ fontSize: 12, fill: "var(--muted)" }} stroke="rgba(255,255,255,0.1)" />
        <YAxis tick={{ fontSize: 12, fill: "var(--muted)" }} stroke="rgba(255,255,255,0.1)" />
        <Tooltip
          contentStyle={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 8, fontSize: 13, color: "var(--foreground)" }}
          labelStyle={{ color: "var(--muted)", fontWeight: 600 }}
        />
        <Line type="monotone" dataKey="plays" stroke="#2563eb" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "#2563eb" }} />
        <Line type="monotone" dataKey="completions" stroke="#10b981" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "#10b981" }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
