"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  Bar,
  BarChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";

type DashboardData = {
  range: {
    from: string;
    to: string;
    days: number;
  };
  kpis: {
    dau: number;
    wau: number;
    plays: number;
    completions: number;
    completionRate: number;
    uniqueStories: number;
    uniqueBooks: number;
  };
  daily: Array<{
    date: string;
    plays: number;
    completions: number;
    completionRate: number;
  }>;
  topStories: Array<{
    storySlug: string;
    plays: number;
    completions: number;
    completionRate: number;
  }>;
  topBooks: Array<{
    bookSlug: string;
    plays: number;
    completions: number;
    completionRate: number;
  }>;
};

const EMPTY_DATA: DashboardData = {
  range: { from: "", to: "", days: 30 },
  kpis: {
    dau: 0,
    wau: 0,
    plays: 0,
    completions: 0,
    completionRate: 0,
    uniqueStories: 0,
    uniqueBooks: 0,
  },
  daily: [],
  topStories: [],
  topBooks: [],
};

export default function MetricsDashboard() {
  const [data, setData] = useState<DashboardData>(EMPTY_DATA);
  const [days, setDays] = useState("30");
  const [bookSlug, setBookSlug] = useState("");
  const [storySlug, setStorySlug] = useState("");
  const [accessKey, setAccessKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("dp_metrics_access_key") ?? "";
      if (saved) setAccessKey(saved);
    } catch {
      // ignore
    }
  }, []);

  async function loadMetrics() {
    setLoading(true);
    setErrorMessage(null);
    try {
      const qs = new URLSearchParams();
      qs.set("days", days);
      if (bookSlug.trim()) qs.set("bookSlug", bookSlug.trim());
      if (storySlug.trim()) qs.set("storySlug", storySlug.trim());
      const res = await fetch(`/api/metrics/dashboard?${qs.toString()}`, {
        headers: accessKey.trim() ? { "x-metrics-key": accessKey.trim() } : undefined,
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const json = (await res.json()) as DashboardData;
      setData(json);
      try {
        if (accessKey.trim()) {
          window.localStorage.setItem("dp_metrics_access_key", accessKey.trim());
        }
      } catch {
        // ignore
      }
    } catch (err) {
      const message =
        err instanceof Error && err.message.includes("403")
          ? "Forbidden: invalid or missing access key."
          : "Failed to load metrics dashboard.";
      setErrorMessage(message);
      console.error("Error loading metrics dashboard:", err);
      setData(EMPTY_DATA);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadMetrics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const kpis = [
    { label: "DAU", value: data.kpis.dau },
    { label: "WAU", value: data.kpis.wau },
    { label: "Plays", value: data.kpis.plays },
    { label: "Completions", value: data.kpis.completions },
    { label: "Completion Rate", value: `${data.kpis.completionRate}%` },
    { label: "Unique Stories", value: data.kpis.uniqueStories },
    { label: "Unique Books", value: data.kpis.uniqueBooks },
  ];

  return (
    <div className="p-6 space-y-8">
      <Card className="border border-border bg-card">
        <CardContent className="pt-6">
          <h1 className="text-2xl font-semibold">Internal Metrics</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Internal usage and listening progress dashboard.
          </p>

          <div className="mt-4 grid gap-3 md:grid-cols-5">
            <select
              value={days}
              onChange={(e) => setDays(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="180">Last 180 days</option>
            </select>
            <input
              value={bookSlug}
              onChange={(e) => setBookSlug(e.target.value)}
              placeholder="Filter by bookSlug"
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            />
            <input
              value={storySlug}
              onChange={(e) => setStorySlug(e.target.value)}
              placeholder="Filter by storySlug"
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            />
            <input
              value={accessKey}
              onChange={(e) => setAccessKey(e.target.value)}
              placeholder="Access key"
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            />
            <button
              onClick={() => void loadMetrics()}
              className="h-10 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-500"
            >
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>
          {errorMessage ? <p className="mt-3 text-sm text-red-500">{errorMessage}</p> : null}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="border border-border bg-card">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">{kpi.label}</p>
              <p className="mt-2 text-2xl font-semibold">{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border border-border bg-card">
        <CardContent className="pt-6">
          <h2 className="text-lg font-semibold mb-4">Daily trend (plays vs completions)</h2>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={data.daily}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="plays" stroke="#2563eb" strokeWidth={2} />
              <Line type="monotone" dataKey="completions" stroke="#16a34a" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="border border-border bg-card">
        <CardContent>
          <h2 className="text-lg font-semibold mb-4">Top stories by usage</h2>

          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={data.topStories}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="storySlug"
                tick={{ fontSize: 12 }}
                interval={0}
                angle={-30}
                textAnchor="end"
              />
              <YAxis />
              <Tooltip />
              <Bar dataKey="plays" fill="#2563eb" />
              <Bar dataKey="completions" fill="#16a34a" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="border border-border bg-card">
        <CardContent className="pt-6">
          <h2 className="text-lg font-semibold mb-4">Top books by usage</h2>
          <div className="space-y-2">
            {data.topBooks.map((book) => (
              <div
                key={book.bookSlug}
                className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
              >
                <span className="font-medium">{book.bookSlug}</span>
                <span className="text-muted-foreground">
                  Plays {book.plays} · Completions {book.completions} · CR {book.completionRate}%
                </span>
              </div>
            ))}
            {data.topBooks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data for current filters.</p>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
