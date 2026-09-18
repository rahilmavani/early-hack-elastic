"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import type { RunState, RunStages, RunSummary } from "@/lib/admin/types";

type Stage = {
  key: keyof RunStages;
  title: string;
  caption: string;
};

const stages: Stage[] = [
  {
    key: "swept",
    title: "Find struggling users",
    caption: "Sessions with dead clicks, rage clicks or server errors",
  },
  {
    key: "rendered",
    title: "Replay on video",
    caption: "Each session is replayed and recorded",
  },
  {
    key: "watched",
    title: "AI watches",
    caption: "Did the user visibly fail? Most sessions are fine",
  },
  {
    key: "confirmed",
    title: "AI double-checks",
    caption: "Tries to prove itself wrong. Only survivors count",
  },
  {
    key: "filed",
    title: "Ticket filed",
    caption: "Case with the clip, the server trace and who else was hit",
  },
];

function useElapsed(run: RunState | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (run?.status !== "running") return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [run?.status]);
  if (!run) return 0;
  const end = run.finished_at ? new Date(run.finished_at).getTime() : now;
  return Math.max(
    0,
    Math.round((end - new Date(run.started_at).getTime()) / 1000),
  );
}

function activeIndex(run: RunState | null) {
  if (!run || run.status !== "running") return -1;
  const last = run.events[run.events.length - 1]?.message ?? "";
  if (run.swept === null) return 0;
  if (run.swept === 0) return -1;
  if (/^rendered /.test(last)) return 2;
  if (/^watched /.test(last)) return 4;
  return 1;
}

function stagesFromSummary(summary: RunSummary): RunStages {
  return {
    swept: summary.swept,
    rendered: summary.rendered,
    watched: summary.watched,
    confirmed: summary.confirmed,
    filed: summary.filed + summary.deduplicated,
  };
}

function Outcome({ summary }: { summary: RunSummary }) {
  return (
    <>
      Checked <b className="text-ink">{summary.watched}</b> sessions.{" "}
      <b className="text-ink">{summary.confirmed}</b> were broken.{" "}
      <b className="text-ink">{summary.filed}</b> new{" "}
      {summary.filed === 1 ? "ticket" : "tickets"},{" "}
      <b className="text-ink">{summary.deduplicated}</b> added to existing ones.
      Cost ${summary.cost_usd.toFixed(2)}.
    </>
  );
}

export function PipelineFunnel({
  run,
  lastSummary,
}: {
  run: RunState | null;
  lastSummary?: RunSummary | null;
}) {
  const elapsed = useElapsed(run);
  const active = activeIndex(run);
  const [showLog, setShowLog] = useState(false);
  const running = run?.status === "running";
  const lastEvent = run?.events[run.events.length - 1]?.message;

  // With no run in this service's memory, show the last finished run from disk.
  const counts: RunStages | null =
    run?.stages ?? (lastSummary ? stagesFromSummary(lastSummary) : null);
  const hasCounts = counts !== null;

  return (
    <section className="border-line rounded-md border">
      <header className="border-line flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold tracking-wide uppercase">
            How the investigation went
          </h2>
          <p className="text-ink-muted mt-1 text-sm">
            {!run && !lastSummary && (
              <>
                Not run yet. Press <b className="text-ink">Run investigation</b>{" "}
                to check the recorded sessions.
              </>
            )}
            {!run && lastSummary && (
              <>
                Last run: <Outcome summary={lastSummary} />
              </>
            )}
            {run && running && (
              <>
                <span className="bg-accent mr-2 inline-block h-2 w-2 animate-pulse rounded-full align-middle" />
                Running for {elapsed}s · {lastEvent ?? "starting"}
              </>
            )}
            {run && run.status === "done" && run.summary && (
              <>
                Done in {elapsed}s. <Outcome summary={run.summary} />
              </>
            )}
            {run && run.status === "failed" && (
              <span className="text-danger">Run failed: {run.error}</span>
            )}
          </p>
        </div>
        {run && (
          <button
            type="button"
            onClick={() => setShowLog((value) => !value)}
            className="text-ink-muted hover:text-ink text-xs font-medium tracking-wide uppercase"
          >
            {showLog ? "Hide log" : "Show log"}
          </button>
        )}
      </header>

      <ol className="grid grid-cols-1 gap-px sm:grid-cols-5">
        {stages.map((stage, index) => {
          const count = counts?.[stage.key] ?? 0;
          const isActive = index === active;
          const isDone =
            hasCounts && (running ? index < active || count > 0 : count > 0);
          return (
            <li
              key={stage.key}
              className={cn(
                "relative px-5 py-5 transition-colors",
                isActive && "bg-accent/5",
                !isActive && isDone && "bg-canvas",
                !isActive && !isDone && "bg-canvas-muted/60",
              )}
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "inline-block h-2 w-2 rounded-full",
                    isActive && "bg-accent animate-pulse",
                    !isActive && isDone && "bg-success",
                    !isActive && !isDone && "bg-line",
                  )}
                />
                <span className="text-ink-muted text-xs font-medium tracking-wide uppercase">
                  {index + 1}. {stage.title}
                </span>
              </div>
              <p
                className={cn(
                  "mt-2 text-3xl font-semibold tracking-tight tabular-nums",
                  !hasCounts && "text-ink-faint",
                )}
              >
                {count}
              </p>
              <p className="text-ink-muted mt-1 text-xs leading-snug">
                {stage.caption}
              </p>
              {index < stages.length - 1 && (
                <span
                  aria-hidden
                  className="text-line absolute top-1/2 -right-2 hidden -translate-y-1/2 text-lg sm:block"
                >
                  ›
                </span>
              )}
            </li>
          );
        })}
      </ol>

      {run && running && run.swept === 0 && (
        <p className="border-line text-ink-muted border-t px-5 py-3 text-sm">
          Nobody struggled in the last {run.window}. Nothing to investigate.
        </p>
      )}

      {run && showLog && (
        <pre className="border-line bg-canvas-muted text-ink max-h-64 overflow-auto border-t px-5 py-4 font-mono text-xs leading-relaxed">
          {run.events
            .map((event) => `${event.at.slice(11, 19)}  ${event.message}`)
            .join("\n")}
        </pre>
      )}
    </section>
  );
}
