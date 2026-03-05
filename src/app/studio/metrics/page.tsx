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

type MetricsSection =
  | "overview"
  | "acquisition"
  | "engagement"
  | "learning"
  | "content"
  | "funnels"
  | "audience"
  | "experiments"
  | "alerts"
  | "exports";

type DashboardData = {
  range: {
    from: string;
    to: string;
    days: number;
  };
  kpis: {
    dau: number;
    wau: number;
    activeUsersInRange: number;
    plays: number;
    completions: number;
    completionRate: number;
    uniqueStories: number;
    uniqueBooks: number;
    avgMinutesPerActiveUser: number;
    totalListenedMinutes: number;
    savedStories: number;
    savedBooks: number;
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
  topStoriesByMinutes: Array<{
    storySlug: string;
    listenedMinutes: number;
    listeners: number;
  }>;
  topSavedStories: Array<{
    storySlug: string;
    saves: number;
  }>;
  topSavedBooks: Array<{
    bookSlug: string;
    saves: number;
  }>;
  trialFunnel: {
    started: number;
    startedWithPm: number;
    day1Active: number;
    converted: number;
    canceled: number;
    conversionRate: number;
    day1ActivationRate: number;
    cancelRate: number;
  };
  checkoutFunnel: {
    plansViewed: number;
    checkoutStarted: number;
    checkoutRedirected: number;
    checkoutFailed: number;
    checkoutStartRate: number;
    checkoutRedirectRate: number;
  };
  upgradeCtaSources: Array<{
    source: string;
    clicks: number;
  }>;
};

const EMPTY_DATA: DashboardData = {
  range: { from: "", to: "", days: 30 },
  kpis: {
    dau: 0,
    wau: 0,
    activeUsersInRange: 0,
    plays: 0,
    completions: 0,
    completionRate: 0,
    uniqueStories: 0,
    uniqueBooks: 0,
    avgMinutesPerActiveUser: 0,
    totalListenedMinutes: 0,
    savedStories: 0,
    savedBooks: 0,
  },
  daily: [],
  topStories: [],
  topBooks: [],
  topStoriesByMinutes: [],
  topSavedStories: [],
  topSavedBooks: [],
  trialFunnel: {
    started: 0,
    startedWithPm: 0,
    day1Active: 0,
    converted: 0,
    canceled: 0,
    conversionRate: 0,
    day1ActivationRate: 0,
    cancelRate: 0,
  },
  checkoutFunnel: {
    plansViewed: 0,
    checkoutStarted: 0,
    checkoutRedirected: 0,
    checkoutFailed: 0,
    checkoutStartRate: 0,
    checkoutRedirectRate: 0,
  },
  upgradeCtaSources: [],
};

export default function MetricsDashboard() {
  const [data, setData] = useState<DashboardData>(EMPTY_DATA);
  const [days, setDays] = useState("30");
  const [bookSlug, setBookSlug] = useState("");
  const [storySlug, setStorySlug] = useState("");
  const [accessKey, setAccessKey] = useState("");
  const [section, setSection] = useState<MetricsSection>("overview");
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
    { label: "Active Users (Range)", value: data.kpis.activeUsersInRange },
    { label: "Plays", value: data.kpis.plays },
    { label: "Completions", value: data.kpis.completions },
    { label: "Completion Rate", value: `${data.kpis.completionRate}%` },
    { label: "Unique Stories", value: data.kpis.uniqueStories },
    { label: "Unique Books", value: data.kpis.uniqueBooks },
    { label: "Avg Min / Active User", value: data.kpis.avgMinutesPerActiveUser },
    { label: "Total Listened (min)", value: data.kpis.totalListenedMinutes },
    { label: "Stories Saved", value: data.kpis.savedStories },
    { label: "Books Saved", value: data.kpis.savedBooks },
  ];

  const sections: Array<{ key: MetricsSection; label: string }> = [
    { key: "overview", label: "Overview" },
    { key: "acquisition", label: "Acquisition" },
    { key: "engagement", label: "Engagement" },
    { key: "learning", label: "Learning Outcomes" },
    { key: "content", label: "Content Performance" },
    { key: "funnels", label: "Funnels" },
    { key: "audience", label: "Audience" },
    { key: "experiments", label: "Experiments" },
    { key: "alerts", label: "Alerts" },
    { key: "exports", label: "Exports" },
  ];

  function EmptySection({
    title,
    description,
  }: {
    title: string;
    description: string;
  }) {
    return (
      <Card className="border border-border bg-card">
        <CardContent className="pt-6">
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        </CardContent>
      </Card>
    );
  }

  function renderSectionContent() {
    if (section === "overview") {
      return (
        <>
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

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="border border-border bg-card">
              <CardContent className="pt-6">
                <h2 className="text-lg font-semibold mb-4">Most listened stories (minutes)</h2>
                <div className="space-y-2">
                  {data.topStoriesByMinutes.map((story) => (
                    <div
                      key={story.storySlug}
                      className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
                    >
                      <span className="font-medium">{story.storySlug}</span>
                      <span className="text-muted-foreground">
                        {story.listenedMinutes} min · {story.listeners} listeners
                      </span>
                    </div>
                  ))}
                  {data.topStoriesByMinutes.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No data for current filters.</p>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border bg-card">
              <CardContent className="pt-6">
                <h2 className="text-lg font-semibold mb-4">Most saved stories</h2>
                <div className="space-y-2">
                  {data.topSavedStories.map((story) => (
                    <div
                      key={story.storySlug}
                      className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
                    >
                      <span className="font-medium">{story.storySlug}</span>
                      <span className="text-muted-foreground">{story.saves} saves</span>
                    </div>
                  ))}
                  {data.topSavedStories.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No data for current filters.</p>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      );
    }

    if (section === "engagement") {
      return (
        <>
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

          <Card className="border border-border bg-card">
            <CardContent className="pt-6">
              <h2 className="text-lg font-semibold mb-4">Top saved books</h2>
              <div className="space-y-2">
                {data.topSavedBooks.map((book) => (
                  <div
                    key={book.bookSlug}
                    className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
                  >
                    <span className="font-medium">{book.bookSlug}</span>
                    <span className="text-muted-foreground">{book.saves} saves</span>
                  </div>
                ))}
                {data.topSavedBooks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No data for current filters.</p>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </>
      );
    }

    if (section === "acquisition") {
      return (
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border border-border bg-card">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Plans viewed</p>
              <p className="mt-2 text-2xl font-semibold">{data.checkoutFunnel.plansViewed}</p>
            </CardContent>
          </Card>
          <Card className="border border-border bg-card">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Checkout started</p>
              <p className="mt-2 text-2xl font-semibold">{data.checkoutFunnel.checkoutStarted}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {data.checkoutFunnel.checkoutStartRate}% from plans view
              </p>
            </CardContent>
          </Card>
          <Card className="border border-border bg-card">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Checkout redirect success</p>
              <p className="mt-2 text-2xl font-semibold">{data.checkoutFunnel.checkoutRedirected}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {data.checkoutFunnel.checkoutRedirectRate}% from checkout start
              </p>
            </CardContent>
          </Card>
          <Card className="border border-border bg-card">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Checkout failed</p>
              <p className="mt-2 text-2xl font-semibold">{data.checkoutFunnel.checkoutFailed}</p>
            </CardContent>
          </Card>
        </div>
      );
    }

    if (section === "learning") {
      return (
        <EmptySection
          title="Learning Outcomes"
          description="Track vocabulary retention, streak performance, and progress by language/level. You can connect favorites + review outcomes in this section."
        />
      );
    }

    if (section === "content") {
      return (
        <EmptySection
          title="Content Performance"
          description="Compare completion rate by topic, level, language, region, and cover/title versions."
        />
      );
    }

    if (section === "funnels") {
      return (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="border border-border bg-card">
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Trial Started</p>
                <p className="mt-2 text-2xl font-semibold">{data.trialFunnel.started}</p>
              </CardContent>
            </Card>
            <Card className="border border-border bg-card">
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Day-1 Active</p>
                <p className="mt-2 text-2xl font-semibold">{data.trialFunnel.day1Active}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {data.trialFunnel.day1ActivationRate}% activation
                </p>
              </CardContent>
            </Card>
            <Card className="border border-border bg-card">
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Converted</p>
                <p className="mt-2 text-2xl font-semibold">{data.trialFunnel.converted}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {data.trialFunnel.conversionRate}% conversion
                </p>
              </CardContent>
            </Card>
            <Card className="border border-border bg-card">
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Canceled</p>
                <p className="mt-2 text-2xl font-semibold">{data.trialFunnel.canceled}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {data.trialFunnel.cancelRate}% cancel rate
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className="border border-border bg-card">
            <CardContent className="pt-6">
              <h2 className="text-lg font-semibold mb-4">Upgrade CTA performance by source</h2>
              <div className="space-y-2">
                {data.upgradeCtaSources.map((row) => (
                  <div
                    key={row.source}
                    className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
                  >
                    <span className="font-medium">{row.source}</span>
                    <span className="text-muted-foreground">{row.clicks} clicks</span>
                  </div>
                ))}
                {data.upgradeCtaSources.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No CTA clicks for current filters.</p>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    if (section === "audience") {
      return (
        <EmptySection
          title="Audience"
          description="Segment new vs returning users, cohorts by week, and behavior by country/device/target language."
        />
      );
    }

    if (section === "experiments") {
      return (
        <EmptySection
          title="Experiments"
          description="Store and compare A/B test variants for covers, titles, CTAs, and paywall copy."
        />
      );
    }

    if (section === "alerts") {
      return (
        <EmptySection
          title="Alerts"
          description="Set thresholds for completion-rate drops, traffic anomalies, and pipeline/API failures."
        />
      );
    }

    return (
      <EmptySection
        title="Exports"
        description="Export weekly snapshots and connect BI tools (Looker Studio/Metabase) with read-only credentials."
      />
    );
  }

  return (
    <div className="p-6">
      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <aside className="space-y-2">
          {sections.map((item) => {
            const active = item.key === section;
            return (
              <button
                key={item.key}
                onClick={() => setSection(item.key)}
                className={`w-full rounded-md px-3 py-2 text-left text-sm transition ${
                  active
                    ? "bg-blue-600 text-white"
                    : "border border-border bg-card text-foreground hover:bg-muted"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </aside>

        <div className="space-y-8">
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

          {renderSectionContent()}
        </div>
      </div>
    </div>
  );
}
