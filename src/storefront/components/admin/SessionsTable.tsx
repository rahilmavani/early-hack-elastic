"use client";

import { cn } from "@/lib/cn";
import {
  formatClock,
  formatDuration,
  lastPage,
  shortId,
  statusLabels,
  type AdminSession,
} from "@/lib/admin/types";

function Chip({
  children,
  tone = "muted",
}: {
  children: React.ReactNode;
  tone?: "muted" | "warn" | "bad";
}) {
  return (
    <span
      className={cn(
        "inline-block rounded-sm px-1.5 py-0.5 text-xs whitespace-nowrap",
        tone === "muted" && "bg-canvas-muted text-ink-muted",
        tone === "warn" && "bg-accent/10 text-accent",
        tone === "bad" && "bg-danger/10 text-danger",
      )}
    >
      {children}
    </span>
  );
}

function SignalChips({ session }: { session: AdminSession }) {
  const s = session.signals;
  const chips: React.ReactNode[] = [];
  if (s.dead_clicks)
    chips.push(
      <Chip key="dead" tone="warn">
        {s.dead_clicks} dead clicks
      </Chip>,
    );
  if (s.rage_clicks)
    chips.push(
      <Chip key="rage" tone="warn">
        {s.rage_clicks} rage bursts
      </Chip>,
    );
  if (s.repeated_submits)
    chips.push(
      <Chip key="resubmit" tone="warn">
        {s.repeated_submits} re-submits
      </Chip>,
    );
  if (s.backend_error)
    chips.push(
      <Chip key="5xx" tone="bad">
        server error
      </Chip>,
    );
  if (s.high_api_latency)
    chips.push(
      <Chip key="slow" tone="bad">
        slow API
      </Chip>,
    );
  if (s.checkout_abandoned)
    chips.push(<Chip key="checkout">checkout abandoned</Chip>);
  else if (s.bag_abandoned) chips.push(<Chip key="bag">bag abandoned</Chip>);
  if (!chips.length)
    return <span className="text-ink-faint text-xs">none</span>;
  return <div className="flex flex-wrap gap-1">{chips}</div>;
}

export function SessionsTable({
  sessions,
  threshold,
}: {
  sessions: AdminSession[];
  threshold: number;
}) {
  if (!sessions.length) {
    return (
      <div className="border-line text-ink-muted rounded-md border px-5 py-10 text-center text-sm">
        No sessions recorded in this window. Open the store in another tab,
        browse and check out, then come back.
      </div>
    );
  }

  return (
    <div className="border-line overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-canvas-muted text-ink-muted text-left text-xs tracking-wide uppercase">
          <tr>
            <th className="px-4 py-3 font-medium">Session</th>
            <th className="px-4 py-3 font-medium">Journey</th>
            <th className="px-4 py-3 font-medium">Length</th>
            <th className="px-4 py-3 font-medium">Signals</th>
            <th className="px-4 py-3 text-right font-medium">Score</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium"></th>
          </tr>
        </thead>
        <tbody className="divide-line divide-y">
          {sessions.map((session) => {
            const status = statusLabels[session.status];
            const scored = session.score !== null;
            return (
              <tr key={session.session_id} className="align-top">
                <td className="px-4 py-3">
                  <div className="font-mono text-xs">
                    {shortId(session.session_id)}
                  </div>
                  <div className="text-ink-faint mt-0.5 text-xs">
                    {formatClock(session.started_at)}
                  </div>
                </td>
                <td className="max-w-[260px] px-4 py-3">
                  <div className="truncate" title={session.pages.join(" → ")}>
                    {session.pages.length > 1 && (
                      <span className="text-ink-faint">
                        {session.pages.length - 1} pages →{" "}
                      </span>
                    )}
                    <code className="text-xs">{lastPage(session.pages)}</code>
                  </div>
                  <div className="text-ink-faint mt-0.5 text-xs">
                    {session.click_count} clicks
                  </div>
                </td>
                <td className="px-4 py-3 tabular-nums">
                  {formatDuration(session.duration_ms)}
                </td>
                <td className="px-4 py-3">
                  <SignalChips session={session} />
                </td>
                <td
                  className={cn(
                    "px-4 py-3 text-right tabular-nums",
                    scored &&
                      (session.score ?? 0) >= threshold &&
                      "text-danger font-semibold",
                  )}
                >
                  {scored ? session.score?.toFixed(1) : "not yet"}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "inline-block rounded-sm px-2 py-0.5 text-xs font-medium whitespace-nowrap",
                      status.className,
                    )}
                  >
                    {status.label}
                  </span>
                  {session.finding?.title && (
                    <div className="text-ink-muted mt-1 max-w-[220px] text-xs leading-snug">
                      {session.finding.headline ?? session.finding.title}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <a
                    href={`/replay/${session.session_id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-ink hover:text-accent text-xs font-medium underline-offset-2 hover:underline"
                  >
                    Replay ↗
                  </a>
                  {session.case_url && (
                    <a
                      href={session.case_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-ink hover:text-accent ml-3 text-xs font-medium underline-offset-2 hover:underline"
                    >
                      Case ↗
                    </a>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
