"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/layout/Container";
import { IncidentCard } from "@/components/admin/IncidentCard";
import { PipelineFunnel } from "@/components/admin/PipelineFunnel";
import { SessionsTable } from "@/components/admin/SessionsTable";
import { cn } from "@/lib/cn";
import {
  formatInr,
  windows,
  type AdminSession,
  type Impact,
  type Incident,
  type RunState,
  type RunSummary,
  type WindowValue,
} from "@/lib/admin/types";

const threshold = 5;
const idlePollMs = 10_000;
const runningPollMs = 2_500;

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      body.error || body.detail || `Request failed (${response.status})`,
    );
  }
  return body as T;
}

function StatTile({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number | string;
  hint?: string;
  tone?: "danger" | "accent";
}) {
  return (
    <div className="border-line rounded-md border px-5 py-4">
      <p className="text-ink-muted text-xs font-medium tracking-wide uppercase">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-3xl font-semibold tracking-tight tabular-nums",
          tone === "danger" && "text-danger",
          tone === "accent" && "text-accent",
        )}
      >
        {value}
      </p>
      {hint && <p className="text-ink-faint mt-1 text-xs">{hint}</p>}
    </div>
  );
}

export function AdminDashboard() {
  const [window_, setWindow] = useState<WindowValue>("1h");
  const [sessions, setSessions] = useState<AdminSession[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [run, setRun] = useState<RunState | null>(null);
  const [history, setHistory] = useState<RunSummary[]>([]);
  const [impact, setImpact] = useState<Impact | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const previousStatus = useRef<string | null>(null);
  const failures = useRef(0);

  const refresh = useCallback(async () => {
    try {
      const [sessionsBody, incidentsBody, runBody, impactBody] =
        await Promise.all([
          getJson<{ sessions: AdminSession[] }>(
            `/api/admin/sessions?window=${window_}&threshold=${threshold}`,
          ),
          getJson<{ incidents: Incident[] }>("/api/admin/incidents"),
          getJson<{ run: RunState | null; history: RunSummary[] }>(
            "/api/admin/runs/latest",
          ),
          getJson<Impact>("/api/admin/impact"),
        ]);
      setImpact(impactBody);
      setSessions(sessionsBody.sessions);
      setIncidents(incidentsBody.incidents);
      setRun(runBody.run);
      setHistory(runBody.history);
      failures.current = 0;
      setError(null);
    } catch (caught) {
      // Keep the last good data through a single failed poll; surface only a repeat.
      failures.current += 1;
      if (failures.current >= 2) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Could not reach the agent.",
        );
      }
    } finally {
      setLoaded(true);
    }
  }, [window_]);

  useEffect(() => {
    // Poll the agent: fetch immediately, then on an interval that tightens while a run is live.
    const interval = run?.status === "running" ? runningPollMs : idlePollMs;
    const initial = setTimeout(refresh, 0);
    const timer = setInterval(refresh, interval);
    return () => {
      clearTimeout(initial);
      clearInterval(timer);
    };
  }, [refresh, run?.status]);

  useEffect(() => {
    // One extra refresh the moment a run finishes so cases and statuses catch up.
    if (previousStatus.current === "running" && run?.status !== "running") {
      refresh();
    }
    previousStatus.current = run?.status ?? null;
  }, [run?.status, refresh]);

  async function startRun() {
    setStarting(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ window: window_ }),
      });
      const body = await response.json().catch(() => ({}));
      if (response.status === 409) {
        setError("An investigation is already running.");
      } else if (!response.ok) {
        throw new Error(
          body.error || body.detail || "Could not start the run.",
        );
      } else {
        setRun(body as RunState);
      }
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not start the run.",
      );
    } finally {
      setStarting(false);
    }
  }

  const running = run?.status === "running";
  const flagged = sessions.filter(
    (session) => (session.score ?? 0) >= threshold,
  ).length;
  const scored = sessions.filter((session) => session.score !== null).length;
  const openIncidents = incidents.filter(
    (incident) => incident.status !== "closed",
  );

  return (
    <main className="pb-24">
      <div className="border-line bg-canvas sticky top-0 z-30 border-b">
        <Container className="flex flex-wrap items-center gap-4 py-4">
          <div className="mr-auto">
            <p className="text-ink-muted text-xs font-medium tracking-[0.2em] uppercase">
              Eyewitness
            </p>
            <h1 className="text-xl font-semibold tracking-tight">
              Northline storefront
            </h1>
          </div>

          <div className="border-line flex overflow-hidden rounded-sm border text-xs font-medium">
            {windows.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setWindow(option.value)}
                disabled={running}
                className={cn(
                  "px-3 py-2 transition-colors disabled:cursor-not-allowed",
                  option.value === window_
                    ? "bg-ink text-white"
                    : "text-ink-muted hover:bg-canvas-muted",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          <Button size="lg" onClick={startRun} disabled={running || starting}>
            {running ? (
              <>
                <span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-white" />
                Investigating…
              </>
            ) : (
              "Run investigation"
            )}
          </Button>
        </Container>
      </div>

      <Container className="space-y-8 pt-8">
        {error && (
          <div className="border-danger/40 bg-danger/5 text-danger rounded-md border px-4 py-3 text-sm">
            {error}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Sessions recorded"
            value={loaded ? sessions.length : "…"}
            hint={`${scored} scored · ${windows.find((w) => w.value === window_)?.label.toLowerCase()}`}
          />
          <StatTile
            label="Look difficult"
            value={loaded ? flagged : "…"}
            hint="dead clicks, rage clicks, server errors"
            tone={flagged ? "accent" : undefined}
          />
          <StatTile
            label="Confirmed broken"
            value={loaded ? incidents.length : "…"}
            hint="AI watched the replay and double-checked"
            tone={incidents.length ? "danger" : undefined}
          />
          <StatTile
            label="Tickets in Kibana"
            value={loaded ? openIncidents.length : "…"}
            hint="open in Kibana Cases"
          />
        </div>

        <PipelineFunnel run={run} lastSummary={history[0] ?? null} />

        {impact && impact.open_incidents > 0 && (
          <section className="border-line rounded-md border">
            <header className="border-line flex flex-wrap items-baseline justify-between gap-2 border-b px-5 py-4">
              <h2 className="text-sm font-semibold tracking-wide uppercase">
                What it is costing the business
              </h2>
              <span className="text-ink-faint text-xs">
                from filed incidents · one assumption: average order value
              </span>
            </header>
            <div className="grid gap-px sm:grid-cols-2 lg:grid-cols-4">
              <div className="px-5 py-5">
                <p className="text-ink-muted text-xs font-medium tracking-wide uppercase">
                  Shoppers hit
                </p>
                <p className="text-danger mt-1 text-3xl font-semibold tracking-tight tabular-nums">
                  {impact.sessions_hit}
                </p>
                <p className="text-ink-faint mt-1 text-xs">
                  sessions that reached a broken page and struggled
                </p>
              </div>
              <div className="px-5 py-5">
                <p className="text-ink-muted text-xs font-medium tracking-wide uppercase">
                  Revenue at risk
                </p>
                <p className="text-danger mt-1 text-3xl font-semibold tracking-tight tabular-nums">
                  {formatInr(impact.revenue_at_risk)}
                </p>
                <p className="text-ink-faint mt-1 text-xs">
                  shoppers hit × {formatInr(impact.average_order_value)} average
                  order
                  {impact.orders_measured
                    ? ` (from ${impact.orders_measured} real orders)`
                    : " (catalogue estimate)"}
                </p>
              </div>
              <div className="px-5 py-5">
                <p className="text-ink-muted text-xs font-medium tracking-wide uppercase">
                  Found within
                </p>
                <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">
                  {impact.median_detect_minutes !== null
                    ? `${Math.round(impact.median_detect_minutes)} min`
                    : "n/a"}
                </p>
                <p className="text-ink-faint mt-1 text-xs">
                  median from session end to ticket filed, no support ticket
                  needed
                </p>
              </div>
              <div className="px-5 py-5">
                <p className="text-ink-muted text-xs font-medium tracking-wide uppercase">
                  Cost to find
                </p>
                <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">
                  {impact.cost_per_confirmed_usd !== null
                    ? `$${impact.cost_per_confirmed_usd.toFixed(2)}`
                    : "n/a"}
                </p>
                <p className="text-ink-faint mt-1 text-xs">
                  per confirmed incident · ${impact.total_cost_usd.toFixed(2)}{" "}
                  across {impact.runs} runs, {impact.sessions_watched} sessions
                  watched
                </p>
              </div>
            </div>
          </section>
        )}

        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold tracking-wide uppercase">
              What is broken
            </h2>
            <span className="text-ink-faint text-xs">
              newest first · press play to see the moment it broke
            </span>
          </div>
          {incidents.length ? (
            <div className="space-y-4">
              {incidents.map((incident) => (
                <IncidentCard key={incident.incident_id} incident={incident} />
              ))}
            </div>
          ) : (
            <div className="border-line text-ink-muted rounded-md border px-5 py-10 text-center text-sm">
              Nothing confirmed broken yet. Run an investigation over a window
              with flagged sessions.
            </div>
          )}
        </section>

        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold tracking-wide uppercase">
              Every recorded session
            </h2>
            <span className="text-ink-faint text-xs">
              newest first · scores appear after an investigation runs
            </span>
          </div>
          <SessionsTable sessions={sessions} threshold={threshold} />
        </section>
      </Container>
    </main>
  );
}
