"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";

export default function MetricsDashboard() {
  const [data, setData] = useState<
    { storySlug: string; plays: number; completions: number; completionRate: number }[]
  >([]);

  useEffect(() => {
    async function loadMetrics() {
      try {
        const res = await fetch("/api/metrics/aggregate");
        if (!res.ok) throw new Error(`Error ${res.status}`);
        const json = await res.json();

        // Asegura que siempre sea un array
        const parsed = Array.isArray(json) ? json : [];
        setData(parsed);
      } catch (err) {
        console.error("❌ Error cargando métricas:", err);
        setData([]);
      }
    }
    loadMetrics();
  }, []);

  return (
    <div className="p-6 space-y-8">
      <Card className="bg-gray-900 text-white border-gray-800">
        <CardContent>
          <h2 className="text-xl font-semibold text-blue-400 mb-4">
            Tasa de completado por historia
          </h2>

          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis
                dataKey="storySlug"
                tick={{ fill: "#ccc", fontSize: 12 }}
                interval={0}
                angle={-30}
                textAnchor="end"
              />
              <YAxis tick={{ fill: "#ccc" }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#111",
                  borderColor: "#444",
                }}
                itemStyle={{ color: "#ddd" }}
              />
              <Bar dataKey="completionRate" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
