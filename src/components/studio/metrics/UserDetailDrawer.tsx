"use client";

import { useEffect, useState } from "react";
import { fmt, KpiCard, LangTag } from "./MetricsPrimitives";
import type { UserDetail } from "./userDetailTypes";

/**
 * Ficha de un usuario: se abre desde cualquier fila de "Altas recientes"
 * y muestra todo lo que sabemos medir de esa persona (sesiones, escucha
 * por historia, práctica, vocabulario, journeys, notificaciones, plan).
 *
 * Panel lateral, no página: el operador vuelve a la tabla sin perder el
 * filtro ni el scroll. Escape y el fondo lo cierran.
 */

function fmtDate(iso: string | null, withTime = false): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  const date = d.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
  if (!withTime) return date;
  return `${date} ${d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}`;
}

function relativeDays(iso: string | null): string | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return null;
  const days = Math.floor(ms / 86400000);
  if (days <= 0) return "hoy";
  if (days === 1) return "ayer";
  if (days < 30) return `hace ${days} días`;
  const months = Math.floor(days / 30);
  return months === 1 ? "hace 1 mes" : `hace ${months} meses`;
}

function Chip({
  children,
  tone = "muted",
  title,
}: {
  children: React.ReactNode;
  tone?: "muted" | "pos" | "warn" | "accent" | "gold";
  title?: string;
}) {
  const color =
    tone === "pos"
      ? "var(--mx-pos)"
      : tone === "warn"
        ? "var(--mx-warn)"
        : tone === "accent"
          ? "var(--mx-accent)"
          : tone === "gold"
            ? "var(--mx-gold)"
            : "var(--mx-muted)";
  return (
    <span className="mx-udchip" style={{ color, borderColor: color }} title={title}>
      {children}
    </span>
  );
}

function Section({
  eyebrow,
  title,
  hint,
  children,
}: {
  eyebrow: string;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-panel">
      <div className="mx-panel__head">
        <div>
          <div className="mx-panel__eyebrow">{eyebrow}</div>
          <h3 className="mx-panel__title">{title}</h3>
        </div>
        {hint && <span className="mx-panel__hint">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 12.5, color: "var(--mx-muted)", margin: 0 }}>{children}</p>;
}

/** Barras diarias de los últimos 90 días. Altura = minutos activos. */
function DailyBars({ daily }: { daily: UserDetail["activity"]["daily"] }) {
  const max = Math.max(1, ...daily.map((d) => d.minutes));
  return (
    <div className="mx-udbars">
      {daily.map((d) => {
        const h = d.minutes > 0 ? Math.max(3, (d.minutes / max) * 100) : 0;
        return (
          <div
            key={d.date}
            className="mx-udbars__slot"
            title={`${d.date} · ${d.minutes} min · ${d.events} eventos`}
          >
            <div
              className="mx-udbars__bar"
              style={{
                height: `${h}%`,
                background: d.minutes > 0 ? "var(--mx-accent)" : "transparent",
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

function ProgressBar({ pct, accent }: { pct: number; accent?: string }) {
  return (
    <div className="mx-udprog">
      <div
        className="mx-udprog__fill"
        style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: accent ?? "var(--mx-accent)" }}
      />
    </div>
  );
}

function StoryTitle({
  title,
  resolved,
  language,
}: {
  title: string;
  resolved: boolean;
  language: string | null;
}) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0 }}>
      {language && <LangTag code={language} />}
      <span
        className={resolved ? undefined : "mx-mono"}
        style={{
          color: resolved ? "var(--mx-fg)" : "var(--mx-muted)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
        title={resolved ? title : "Historia sin título en catálogo (slug crudo)"}
      >
        {title}
      </span>
    </span>
  );
}

export default function UserDetailDrawer({
  userId,
  onClose,
}: {
  userId: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);
    fetch(`/api/metrics/user/${encodeURIComponent(userId)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((j) => {
        if (!cancelled) setData(j as UserDetail);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "error");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const u = data?.user;

  return (
    <div className="mx-uddrawer-root" role="dialog" aria-modal="true" aria-label="Ficha de usuario">
      <button
        type="button"
        className="mx-uddrawer__scrim"
        onClick={onClose}
        aria-label="Cerrar ficha"
      />
      <aside className="mx-uddrawer">
        <header className="mx-uddrawer__head">
          <div style={{ minWidth: 0 }}>
            <div className="mx-panel__eyebrow">Ficha de usuario</div>
            <h2 className="mx-uddrawer__name">
              {u?.name ?? (loading ? "Cargando…" : "Sin nombre")}
            </h2>
            <div className="mx-mono" style={{ color: "var(--mx-muted)", marginTop: 2 }}>
              {u?.email ?? userId}
            </div>
            {u && (
              <div className="mx-uddrawer__chips">
                {u.platform === "ios" && <Chip tone="accent">iOS</Chip>}
                {u.platform === "web" && <Chip tone="accent">Web</Chip>}
                {u.targetLanguages.map((l) => (
                  <Chip key={l}>{l}</Chip>
                ))}
                {u.level && <Chip>{u.level}</Chip>}
                {data?.plan && (
                  <Chip tone={data.monetization.paid ? "gold" : "muted"}>
                    {data.plan.plan} · {data.plan.status}
                  </Chip>
                )}
                {!data?.plan && <Chip>sin plan</Chip>}
                {data?.beta && <Chip tone="pos">beta: {data.beta.status}</Chip>}
                {u.pushTokens > 0 && (
                  <Chip tone="pos" title="Tiene la app instalada con push registrado">
                    push ×{u.pushTokens}
                  </Chip>
                )}
              </div>
            )}
          </div>
          <button type="button" className="mx-uddrawer__close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </header>

        <div className="mx-uddrawer__body mx-root">
          {loading && <Empty>Cargando métricas del usuario…</Empty>}
          {error && (
            <div className="mx-panel" style={{ borderColor: "rgba(239,68,68,0.35)" }}>
              <Empty>No se pudieron cargar las métricas: {error}</Empty>
            </div>
          )}

          {data && (
            <div className="mx-view">
              {/* ── Resumen ── */}
              <div className="mx-uddrawer__kpis">
                <KpiCard
                  label="Minutos escuchados"
                  value={data.listening.totalMinutes}
                  accent="gold"
                  hint={`${data.listening.uniqueStories} historias tocadas`}
                />
                <KpiCard
                  label="Sesiones"
                  value={data.activity.sessions}
                  hint={`${data.activity.avgSessionMinutes} min de media`}
                />
                <KpiCard
                  label="Días activos"
                  value={data.activity.activeDays}
                  accent="cyan"
                  hint={`racha ${data.activity.currentStreakDays} · máx ${data.activity.longestStreakDays}`}
                />
                <KpiCard
                  label="Historias completadas"
                  value={data.listening.completions}
                  accent="xp"
                  hint={`${data.listening.completionRate}% de ${data.listening.plays} plays`}
                />
                <KpiCard
                  label="Prácticas completadas"
                  value={data.practice.completed}
                  accent="xp"
                  hint={
                    data.practice.avgAccuracy !== null
                      ? `${data.practice.avgAccuracy}% de acierto`
                      : "sin puntuación"
                  }
                />
                <KpiCard
                  label="Palabras guardadas"
                  value={data.vocab.savedWords}
                  accent="gems"
                  hint={`${data.vocab.clicks} consultas`}
                />
              </div>

              {/* ── Cuenta ── */}
              <Section
                eyebrow="Cuenta"
                title="Identidad y ciclo de vida"
                hint={data.activity.truncated ? "eventos truncados a 30.000" : undefined}
              >
                <div className="mx-udgrid">
                  <div>
                    <span className="mx-udgrid__k">Alta</span>
                    <span className="mx-udgrid__v">
                      {fmtDate(u?.createdAt ?? null)}{" "}
                      <span style={{ color: "var(--mx-muted)" }}>
                        {relativeDays(u?.createdAt ?? null)}
                      </span>
                    </span>
                  </div>
                  <div>
                    <span className="mx-udgrid__k">Último acceso</span>
                    <span className="mx-udgrid__v">
                      {fmtDate(u?.lastSignInAt ?? null)}{" "}
                      <span style={{ color: "var(--mx-muted)" }}>
                        {relativeDays(u?.lastSignInAt ?? null)}
                      </span>
                    </span>
                  </div>
                  <div>
                    <span className="mx-udgrid__k">Primera actividad</span>
                    <span className="mx-udgrid__v">
                      {fmtDate(data.activity.firstEventAt, true)}
                    </span>
                  </div>
                  <div>
                    <span className="mx-udgrid__k">Última actividad</span>
                    <span className="mx-udgrid__v">
                      {fmtDate(data.activity.lastEventAt, true)}{" "}
                      <span style={{ color: "var(--mx-muted)" }}>
                        {relativeDays(data.activity.lastEventAt)}
                      </span>
                    </span>
                  </div>
                  <div>
                    <span className="mx-udgrid__k">Onboarding</span>
                    <span className="mx-udgrid__v">
                      {data.onboarding.finished
                        ? `terminado · ${fmtDate(data.onboarding.finishedAt)}`
                        : data.onboarding.abandoned
                          ? "abandonado"
                          : data.onboarding.stepsCompleted.length
                            ? `pasos ${data.onboarding.stepsCompleted.join(", ")}`
                            : data.onboarding.started
                              ? "empezado"
                              : "sin datos"}
                    </span>
                  </div>
                  <div>
                    <span className="mx-udgrid__k">Test de nivel</span>
                    <span className="mx-udgrid__v">
                      {data.onboarding.levelTestCompleted
                        ? "completado"
                        : data.onboarding.levelTestStarted
                          ? "empezado, sin terminar"
                          : "no lo hizo"}
                    </span>
                  </div>
                  <div>
                    <span className="mx-udgrid__k">Meta diaria</span>
                    <span className="mx-udgrid__v">
                      {u?.dailyMinutesGoal ? `${u.dailyMinutesGoal} min/día` : "-"}
                    </span>
                  </div>
                  <div>
                    <span className="mx-udgrid__k">Recordatorios</span>
                    <span className="mx-udgrid__v">
                      {u?.remindersEnabled === null || u?.remindersEnabled === undefined
                        ? "-"
                        : u.remindersEnabled
                          ? "activados"
                          : "desactivados"}
                    </span>
                  </div>
                  <div>
                    <span className="mx-udgrid__k">Emails</span>
                    <span className="mx-udgrid__v">
                      {data.emailPrefs
                        ? data.emailPrefs.unsubscribedAll
                          ? "dado de baja"
                          : [
                              data.emailPrefs.progress ? "progreso" : null,
                              data.emailPrefs.reminders ? "recordatorios" : null,
                            ]
                              .filter(Boolean)
                              .join(" · ") || "todo desactivado"
                        : "por defecto"}
                    </span>
                  </div>
                  <div>
                    <span className="mx-udgrid__k">userId</span>
                    <span className="mx-udgrid__v mx-mono">{data.user.userId}</span>
                  </div>
                  <div>
                    <span className="mx-udgrid__k">Guardados</span>
                    <span className="mx-udgrid__v">
                      {data.library.savedStories} historias · {data.library.savedBooks} libros
                    </span>
                  </div>
                  <div>
                    <span className="mx-udgrid__k">Historias propias</span>
                    <span className="mx-udgrid__v">{data.library.ownStories}</span>
                  </div>
                </div>
                {data.plan && (
                  <>
                    <div className="mx-panel__sub">Suscripción</div>
                    <div className="mx-udgrid">
                      <div>
                        <span className="mx-udgrid__k">Plan</span>
                        <span className="mx-udgrid__v">
                          {data.plan.plan} · {data.plan.source}
                        </span>
                      </div>
                      <div>
                        <span className="mx-udgrid__k">Estado</span>
                        <span className="mx-udgrid__v">
                          {data.plan.status}
                          {data.plan.willRenew ? " · renueva" : " · no renueva"}
                        </span>
                      </div>
                      <div>
                        <span className="mx-udgrid__k">Inicio</span>
                        <span className="mx-udgrid__v">{fmtDate(data.plan.startedAt)}</span>
                      </div>
                      <div>
                        <span className="mx-udgrid__k">Caduca</span>
                        <span className="mx-udgrid__v">{fmtDate(data.plan.expiresAt)}</span>
                      </div>
                      {data.plan.trialEndsAt && (
                        <div>
                          <span className="mx-udgrid__k">Fin del trial</span>
                          <span className="mx-udgrid__v">{fmtDate(data.plan.trialEndsAt)}</span>
                        </div>
                      )}
                    </div>
                  </>
                )}
                {data.beta && (
                  <>
                    <div className="mx-panel__sub">Beta</div>
                    <div className="mx-udgrid">
                      <div>
                        <span className="mx-udgrid__k">Estado</span>
                        <span className="mx-udgrid__v">{data.beta.status}</span>
                      </div>
                      <div>
                        <span className="mx-udgrid__k">Solicitó</span>
                        <span className="mx-udgrid__v">{fmtDate(data.beta.appliedAt)}</span>
                      </div>
                      <div>
                        <span className="mx-udgrid__k">Invitado</span>
                        <span className="mx-udgrid__v">{fmtDate(data.beta.invitedAt)}</span>
                      </div>
                      <div>
                        <span className="mx-udgrid__k">Feedback</span>
                        <span className="mx-udgrid__v">{data.beta.feedbackCount} envíos</span>
                      </div>
                    </div>
                    {data.beta.recentFeedback.length > 0 && (
                      <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                        {data.beta.recentFeedback.map((f, i) => (
                          <div key={i} className="mx-udnote">
                            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                              <Chip>{f.kind}</Chip>
                              {f.rating !== null && <Chip tone="gold">{f.rating}</Chip>}
                              <span className="mx-table__when">{fmtDate(f.at)}</span>
                            </div>
                            <p style={{ margin: "6px 0 0", fontSize: 12.5 }}>{f.message}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </Section>

              {/* ── Actividad ── */}
              <Section
                eyebrow="Actividad"
                title="Sesiones y constancia"
                hint="minutos activos por día · últimos 90 días"
              >
                <DailyBars daily={data.activity.daily} />
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4, 1fr)",
                    gap: 10,
                    marginTop: 14,
                  }}
                >
                  <KpiCard label="Tiempo activo total" value={data.activity.totalActiveMinutes} suffix="min" />
                  <KpiCard label="Sesión más larga" value={data.activity.longestSessionMinutes} suffix="min" />
                  <KpiCard label="Eventos registrados" value={data.activity.totalEvents} />
                  <KpiCard
                    label="Plataforma"
                    value={
                      data.activity.byPlatform.ios > data.activity.byPlatform.web ? "iOS" : "Web"
                    }
                    hint={`iOS ${data.activity.byPlatform.ios} · Web ${data.activity.byPlatform.web} · s/d ${data.activity.byPlatform.unknown}`}
                  />
                </div>

                <div className="mx-panel__sub">Últimas sesiones</div>
                {data.activity.recentSessions.length === 0 ? (
                  <Empty>Sin sesiones registradas.</Empty>
                ) : (
                  <table className="mx-table">
                    <thead>
                      <tr>
                        <th>Inicio</th>
                        <th>Duración</th>
                        <th>Eventos</th>
                        <th>Historias</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.activity.recentSessions.map((s) => (
                        <tr key={s.startedAt}>
                          <td className="mx-table__when">{fmtDate(s.startedAt, true)}</td>
                          <td className="mx-table__num">{s.minutes} min</td>
                          <td className="mx-table__num">{s.events}</td>
                          <td style={{ maxWidth: 280 }}>
                            <span
                              style={{
                                display: "block",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                              title={s.stories.join(", ")}
                            >
                              {s.stories.length ? s.stories.join(", ") : "-"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Section>

              {/* ── Escucha ── */}
              <Section
                eyebrow="Escucha"
                title="Historias más oídas"
                hint="minutos = progreso máximo alcanzado por historia"
              >
                {data.listening.stories.length === 0 ? (
                  <Empty>Este usuario todavía no ha escuchado nada.</Empty>
                ) : (
                  <table className="mx-table">
                    <thead>
                      <tr>
                        <th style={{ width: 24 }}>#</th>
                        <th>Historia</th>
                        <th style={{ width: 130 }}>Progreso</th>
                        <th style={{ width: 70, textAlign: "right" }}>Min</th>
                        <th style={{ width: 60, textAlign: "right" }}>Plays</th>
                        <th style={{ width: 60, textAlign: "right" }}>Fin</th>
                        <th style={{ width: 110 }}>Última vez</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.listening.stories.map((s, i) => (
                        <tr key={s.slug}>
                          <td className="mx-table__rank">{String(i + 1).padStart(2, "0")}</td>
                          <td style={{ maxWidth: 240 }}>
                            <StoryTitle
                              title={s.title}
                              resolved={s.titleResolved}
                              language={s.language}
                            />
                          </td>
                          <td>
                            {s.progressPct !== null ? (
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <ProgressBar
                                  pct={s.progressPct}
                                  accent={s.completions > 0 ? "var(--mx-xp)" : undefined}
                                />
                                <span className="mx-mono" style={{ width: 34, textAlign: "right" }}>
                                  {s.progressPct}%
                                </span>
                              </div>
                            ) : (
                              <span style={{ color: "var(--mx-muted)" }}>s/d</span>
                            )}
                          </td>
                          <td className="mx-table__num">{fmt(s.minutes)}</td>
                          <td className="mx-table__num">{s.plays || "-"}</td>
                          <td className="mx-table__num">{s.completions || "-"}</td>
                          <td className="mx-table__when">{fmtDate(s.lastAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4, 1fr)",
                    gap: 10,
                    marginTop: 14,
                  }}
                >
                  <KpiCard label="Historias abiertas" value={data.listening.storiesOpened} />
                  <KpiCard label="Libros distintos" value={data.listening.uniqueBooks} />
                  <KpiCard label="Saltos de audio" value={data.listening.seeks} />
                  <KpiCard
                    label="Velocidad"
                    value={data.listening.lastSpeed !== null ? `${data.listening.lastSpeed}x` : "-"}
                    hint={`${data.listening.speedChanges} cambios`}
                  />
                </div>

                {data.listening.inProgress.length > 0 && (
                  <>
                    <div className="mx-panel__sub">A medias (seguir escuchando)</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {data.listening.inProgress.map((s) => (
                        <div key={s.slug} className="mx-udrow">
                          <StoryTitle
                            title={s.title}
                            resolved={s.titleResolved}
                            language={s.language}
                          />
                          <span style={{ flex: 1 }} />
                          {s.pct !== null && (
                            <span className="mx-mono" style={{ color: "var(--mx-muted)" }}>
                              {s.pct}%
                            </span>
                          )}
                          <span className="mx-table__when">{fmtDate(s.lastPlayedAt)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </Section>

              {/* ── Práctica ── */}
              <Section
                eyebrow="Práctica"
                title="Ejercicios"
                hint={data.practice.lastAt ? `última: ${fmtDate(data.practice.lastAt, true)}` : undefined}
              >
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                  <KpiCard label="Sesiones empezadas" value={data.practice.started} />
                  <KpiCard
                    label="Completadas"
                    value={data.practice.completed}
                    accent="xp"
                    hint={`${data.practice.completionRate}% de las empezadas`}
                  />
                  <KpiCard
                    label="Precisión media"
                    value={data.practice.avgAccuracy !== null ? data.practice.avgAccuracy : "-"}
                    suffix={data.practice.avgAccuracy !== null ? "%" : undefined}
                    accent="gold"
                  />
                  <KpiCard label="Ejercicios resueltos" value={data.practice.totalItems} />
                </div>

                {data.practice.byMode.length > 0 && (
                  <>
                    <div className="mx-panel__sub">Por modo</div>
                    <table className="mx-table">
                      <thead>
                        <tr>
                          <th>Modo</th>
                          <th style={{ textAlign: "right" }}>Sesiones</th>
                          <th style={{ textAlign: "right" }}>Precisión</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.practice.byMode.map((m) => (
                          <tr key={m.mode}>
                            <td>{m.mode}</td>
                            <td className="mx-table__num">{m.sessions}</td>
                            <td className="mx-table__num">
                              {m.avgAccuracy !== null ? `${m.avgAccuracy}%` : "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}

                {data.practice.recent.length > 0 && (
                  <>
                    <div className="mx-panel__sub">Últimas prácticas</div>
                    <table className="mx-table">
                      <thead>
                        <tr>
                          <th>Cuándo</th>
                          <th>Historia</th>
                          <th>Modo</th>
                          <th style={{ textAlign: "right" }}>Acierto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.practice.recent.map((p, i) => (
                          <tr key={`${p.at}-${i}`}>
                            <td className="mx-table__when">{fmtDate(p.at, true)}</td>
                            <td style={{ maxWidth: 220 }}>{p.storyTitle ?? "-"}</td>
                            <td>{p.mode ?? "-"}</td>
                            <td className="mx-table__num">
                              {p.accuracy !== null ? `${p.accuracy}%` : "-"}
                              {p.items ? (
                                <span style={{ color: "var(--mx-muted)" }}> /{p.items}</span>
                              ) : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
                {data.practice.started === 0 && <Empty>Nunca ha hecho práctica.</Empty>}
              </Section>

              {/* ── Vocabulario ── */}
              <Section eyebrow="Vocabulario" title="Palabras" hint="consultas en el lector y guardados">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                  <KpiCard label="Consultas" value={data.vocab.clicks} />
                  <KpiCard label="Palabras distintas" value={data.vocab.uniqueWords} accent="cyan" />
                  <KpiCard label="Guardadas" value={data.vocab.savedWords} accent="gems" />
                  <KpiCard label="Colecciones" value={data.vocab.collections} />
                </div>

                {data.vocab.topWords.length > 0 && (
                  <>
                    <div className="mx-panel__sub">Más consultadas</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {data.vocab.topWords.map((w) => (
                        <span key={w.word} className="mx-udchip" style={{ color: "var(--mx-fg-soft)" }}>
                          {w.word}
                          <span style={{ color: "var(--mx-muted)", marginLeft: 5 }}>×{w.count}</span>
                        </span>
                      ))}
                    </div>
                  </>
                )}

                {data.vocab.recentSaved.length > 0 && (
                  <>
                    <div className="mx-panel__sub">Últimas guardadas</div>
                    <table className="mx-table">
                      <thead>
                        <tr>
                          <th>Palabra</th>
                          <th>Traducción</th>
                          <th>Historia</th>
                          <th style={{ width: 100 }}>Cuándo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.vocab.recentSaved.map((f, i) => (
                          <tr key={`${f.word}-${i}`}>
                            <td style={{ color: "var(--mx-fg)" }}>{f.word}</td>
                            <td>{f.translation}</td>
                            <td style={{ maxWidth: 200 }}>{f.storyTitle ?? "-"}</td>
                            <td className="mx-table__when">{fmtDate(f.createdAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
                {data.vocab.clicks === 0 && data.vocab.savedWords === 0 && (
                  <Empty>No ha tocado ninguna palabra todavía.</Empty>
                )}
              </Section>

              {/* ── Journeys ── */}
              <Section eyebrow="Journeys" title="Recorridos" hint="qué journey eligió y hasta dónde llegó">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                  <KpiCard label="Journeys elegidos" value={data.journeys.variantSelected} />
                  <KpiCard label="Temas abiertos" value={data.journeys.topicOpened} accent="cyan" />
                  <KpiCard label="Historias leídas" value={data.journeys.storiesRead} accent="xp" />
                  <KpiCard label="Checkpoints" value={data.journeys.checkpoints} accent="gold" />
                </div>

                {data.journeys.variants.length > 0 && (
                  <>
                    <div className="mx-panel__sub">Journeys tocados</div>
                    <table className="mx-table">
                      <thead>
                        <tr>
                          <th>Journey</th>
                          <th style={{ textAlign: "right" }}>Eventos</th>
                          <th style={{ width: 110 }}>Última vez</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.journeys.variants.map((v) => (
                          <tr key={v.variantId}>
                            <td>
                              <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                                {v.language && <LangTag code={v.language} />}
                                <span>
                                  {v.name}
                                  {/* Varios journeys comparten nombre ("Traveler");
                                      la variante es lo que los distingue. */}
                                  {v.variant && (
                                    <span style={{ color: "var(--mx-muted)" }}> · {v.variant}</span>
                                  )}
                                </span>
                                {v.status && v.status !== "active" && (
                                  <span style={{ color: "var(--mx-muted)", fontSize: 11 }}>
                                    ({v.status})
                                  </span>
                                )}
                              </span>
                            </td>
                            <td className="mx-table__num">{v.events}</td>
                            <td className="mx-table__when">{fmtDate(v.lastAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}

                {data.journeys.topics.length > 0 && (
                  <>
                    <div className="mx-panel__sub">Temas</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {data.journeys.topics.map((t) => (
                        <span key={t.topicId} className="mx-udchip" style={{ color: "var(--mx-fg-soft)" }}>
                          {t.label}
                          <span style={{ color: "var(--mx-muted)", marginLeft: 5 }}>×{t.opens}</span>
                        </span>
                      ))}
                    </div>
                  </>
                )}
                {data.journeys.variantSelected === 0 && data.journeys.topicOpened === 0 && (
                  <Empty>Nunca entró a un journey.</Empty>
                )}
              </Section>

              {/* ── Notificaciones y monetización ── */}
              <Section eyebrow="Notificaciones" title="Recordatorios y push">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                  <KpiCard label="Programados" value={data.notifications.scheduled} />
                  <KpiCard
                    label="Tocados"
                    value={data.notifications.tapped}
                    accent="xp"
                    hint={`${data.notifications.tapRate}% de los programados`}
                  />
                  <KpiCard label="Llegaron al destino" value={data.notifications.destinationOpened} />
                  <KpiCard label="Push abiertos" value={data.notifications.pushOpened} />
                </div>
                {data.notifications.byTarget.length > 0 && (
                  <>
                    <div className="mx-panel__sub">Por tipo</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {data.notifications.byTarget.map((t) => (
                        <span key={t.kind} className="mx-udchip" style={{ color: "var(--mx-fg-soft)" }}>
                          {t.kind}
                          <span style={{ color: "var(--mx-muted)", marginLeft: 5 }}>×{t.count}</span>
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </Section>

              <Section eyebrow="Monetización" title="Camino al pago">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                  <KpiCard
                    label="Vio precios"
                    value={data.monetization.plansViewed}
                    hint={
                      data.monetization.lastPlansViewedAt
                        ? fmtDate(data.monetization.lastPlansViewedAt)
                        : undefined
                    }
                  />
                  <KpiCard label="Clics en upgrade" value={data.monetization.upgradeCtaClicks} accent="cyan" />
                  <KpiCard
                    label="Trial"
                    value={
                      data.monetization.trialConverted
                        ? "convertido"
                        : data.monetization.trialCanceled
                          ? "cancelado"
                          : data.monetization.trialStarted
                            ? "activo"
                            : "-"
                    }
                    accent="gold"
                  />
                  <KpiCard
                    label="Pagó"
                    value={data.monetization.paid ? "sí" : "no"}
                    accent={data.monetization.paid ? "gold" : "accent"}
                  />
                </div>
                {data.monetization.ctaSources.length > 0 && (
                  <>
                    <div className="mx-panel__sub">Origen de los clics</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {data.monetization.ctaSources.map((c) => (
                        <span key={c.source} className="mx-udchip" style={{ color: "var(--mx-fg-soft)" }}>
                          {c.source}
                          <span style={{ color: "var(--mx-muted)", marginLeft: 5 }}>×{c.count}</span>
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </Section>

              {/* ── Timeline ── */}
              <Section
                eyebrow="Timeline"
                title="Últimos eventos"
                hint={`${data.timeline.length} de ${fmt(data.activity.totalEvents)}`}
              >
                {data.timeline.length === 0 ? (
                  <Empty>Sin eventos.</Empty>
                ) : (
                  <table className="mx-table">
                    <thead>
                      <tr>
                        <th style={{ width: 130 }}>Cuándo</th>
                        <th style={{ width: 180 }}>Evento</th>
                        <th>Historia</th>
                        <th style={{ width: 160 }}>Detalle</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.timeline.map((t, i) => (
                        <tr key={`${t.at}-${i}`}>
                          <td className="mx-table__when">{fmtDate(t.at, true)}</td>
                          <td className="mx-table__slug">{t.eventType}</td>
                          <td style={{ maxWidth: 220 }}>
                            <span
                              style={{
                                display: "block",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {t.storyTitle ?? "-"}
                            </span>
                          </td>
                          <td style={{ color: "var(--mx-muted)" }}>{t.detail ?? "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Section>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
