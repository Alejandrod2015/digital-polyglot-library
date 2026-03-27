"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Props = {
  data: Array<{
    storySlug: string;
    plays: number;
    completions: number;
  }>;
};

export default function MetricsEngagementChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
        <XAxis
          dataKey="storySlug"
          tick={{ fontSize: 11, fill: "var(--muted)" }}
          interval={0}
          angle={-30}
          textAnchor="end"
          stroke="rgba(255,255,255,0.1)"
        />
        <YAxis tick={{ fontSize: 12, fill: "var(--muted)" }} stroke="rgba(255,255,255,0.1)" />
        <Tooltip
          contentStyle={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 8, fontSize: 13, color: "var(--foreground)" }}
          labelStyle={{ color: "var(--muted)", fontWeight: 600 }}
        />
        <Bar dataKey="plays" fill="#2563eb" radius={[4, 4, 0, 0]} />
        <Bar dataKey="completions" fill="#10b981" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
