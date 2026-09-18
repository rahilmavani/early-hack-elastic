"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/cn";
import {
  clip,
  formatSeconds,
  shortId,
  timeAgo,
  type Incident,
} from "@/lib/admin/types";

// The card is built so a viewer gets the story in three glances:
//   1. a plain-English headline and who it hit
//   2. the moment on screen, one click from playing
//   3. tried → expected → got, one short line each
// Everything an engineer might want sits behind "Details".

function clipSource(incident: Incident) {
  if (incident.has_clip) {
    return `/api/admin/renders/${encodeURIComponent(incident.session_id)}/clip.webm`;
  }
  return incident.clip_url;
}

function frameUrl(incident: Incident, second: number) {
  return `/api/admin/renders/${encodeURIComponent(incident.session_id)}/frames/${second}.jpg`;
}

function Step({
  number,
  label,
  text,
  tone,
}: {
  number: number;
  label: string;
  text: string;
  tone?: "bad";
}) {
  return (
    <li className="flex gap-3">
      <span
        className={cn(
          "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
          tone === "bad" ? "bg-danger text-white" : "bg-ink text-white",
        )}
      >
        {number}
      </span>
      <div className="min-w-0">
        <p className="text-ink-faint text-[11px] font-medium tracking-wide uppercase">
          {label}
        </p>
        <p
          className={cn(
            "text-sm leading-snug",
            tone === "bad" && "text-danger font-medium",
          )}
        >
          {text}
        </p>
      </div>
    </li>
  );
}

function Check({
  ok,
  children,
}: {
  ok: boolean | null;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span
        className={cn(
          "inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold",
          ok === true && "bg-success/15 text-success",
          ok === false && "bg-danger/15 text-danger",
          ok === null && "bg-canvas-muted text-ink-faint",
        )}
      >
        {ok === false ? "!" : "✓"}
      </span>
      <span className="text-ink-muted">{children}</span>
    </span>
  );
}

export function IncidentCard({ incident }: { incident: Incident }) {
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const finding = incident.finding;
  const source = clipSource(incident);
  const failingSecond =
    incident.failing_second ?? finding?.failing_second ?? null;
  const page = finding?.page ?? incident.fingerprint?.split(":")[0] ?? null;

  const headline = incident.headline ?? finding?.headline ?? incident.title;
  const tried =
    incident.step_tried ??
    finding?.step_tried ??
    clip(finding?.user_intent, 70);
  const expected =
    incident.step_expected ??
    finding?.step_expected ??
    clip(finding?.expected, 70);
  const got =
    incident.step_got ?? finding?.step_got ?? clip(finding?.observed, 80);

  const backendFailed =
    incident.status_code !== null && incident.status_code >= 400;
  const review =
    incident.review ??
    (finding?.counterargument
      ? {
          verdict: finding.review_verdict ?? "confirm",
          counterargument: finding.counterargument,
          confidence: finding.review_confidence ?? 0,
        }
      : null);

  const evidenceSeconds = (finding?.evidence_seconds ?? []).slice(0, 4);
  const poster =
    incident.has_clip && failingSecond !== null
      ? frameUrl(incident, failingSecond)
      : undefined;
  const others = Math.max(0, incident.affected_users - 1);

  function watchTheMoment() {
    const element = video.current;
    if (!element) return;
    setPlaying(true);
    if (failingSecond !== null) {
      element.currentTime = Math.max(0, failingSecond - 3);
    }
    element.play().catch(() => undefined);
  }

  return (
    <article className="border-line overflow-hidden rounded-md border">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_460px]">
        <div className="p-5 lg:p-6">
          <div className="text-ink-muted flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            <span className="bg-danger inline-block h-2 w-2 rounded-full" />
            <span className="text-danger font-semibold tracking-wide uppercase">
              {incident.status === "closed" ? "Resolved" : "Open"}
            </span>
            {page && (
              <>
                <span aria-hidden>·</span>
                <span>
                  on <code className="text-ink">{page}</code>
                </span>
              </>
            )}
            <span aria-hidden>·</span>
            <span>{timeAgo(incident.last_seen_at ?? incident.created_at)}</span>
          </div>

          <h3 className="mt-2 text-2xl leading-tight font-semibold tracking-tight">
            {headline}
          </h3>

          <p className="text-ink-muted mt-1 text-sm">
            {others > 0
              ? `Seen in this session and ${others} other${others === 1 ? "" : "s"}.`
              : "Seen in this session so far."}
          </p>

          <ol className="mt-6 grid gap-4 sm:grid-cols-3">
            <Step number={1} label="User tried" text={tried} />
            <Step number={2} label="Should have" text={expected} />
            <Step number={3} label="Got instead" text={got} tone="bad" />
          </ol>

          <div className="border-line mt-6 flex flex-wrap gap-x-5 gap-y-2 border-t pt-4">
            <Check ok={true}>On screen at {formatSeconds(failingSecond)}</Check>
            {incident.route ? (
              <Check ok={!backendFailed}>
                {backendFailed
                  ? `Server failed: ${incident.route} → ${incident.status_code}`
                  : `Server looked fine (${incident.status_code})`}
              </Check>
            ) : (
              <Check ok={null}>Never reached the server</Check>
            )}
            {review && (
              <Check ok={review.verdict === "confirm"}>
                Survived cross-examination ·{" "}
                {Math.round(review.confidence * 100)}%
              </Check>
            )}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            {incident.case_url && (
              <a
                href={incident.case_url}
                target="_blank"
                rel="noreferrer"
                className="bg-ink inline-flex h-10 items-center px-4 text-sm font-medium text-white hover:bg-black"
              >
                Open case
              </a>
            )}
            <a
              href={`/replay/${incident.session_id}`}
              target="_blank"
              rel="noreferrer"
              className="border-ink text-ink hover:bg-canvas-muted inline-flex h-10 items-center border px-4 text-sm font-medium"
            >
              Full replay
            </a>
            <button
              type="button"
              onClick={() => setShowDetails((value) => !value)}
              className="text-ink-muted hover:text-ink ml-auto text-xs font-medium tracking-wide uppercase"
            >
              Details {showDetails ? "▲" : "▼"}
            </button>
          </div>
        </div>

        <div className="bg-canvas-muted/60 border-line p-4 lg:border-l">
          {source ? (
            <div className="relative">
              <video
                ref={video}
                src={source}
                poster={poster}
                controls={playing}
                preload="metadata"
                onPause={() => setPlaying(false)}
                onPlay={() => setPlaying(true)}
                className="bg-canvas aspect-video w-full rounded-sm"
              />
              {!playing && (
                <button
                  type="button"
                  onClick={watchTheMoment}
                  className="group absolute inset-0 flex items-center justify-center rounded-sm bg-black/10 transition-colors hover:bg-black/20"
                >
                  <span className="bg-canvas text-ink inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium shadow-md">
                    <span className="bg-ink inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] text-white">
                      ▶
                    </span>
                    Watch the moment
                    {failingSecond !== null && (
                      <span className="text-ink-muted tabular-nums">
                        {formatSeconds(failingSecond)}
                      </span>
                    )}
                  </span>
                </button>
              )}
            </div>
          ) : (
            <div className="bg-canvas text-ink-muted flex aspect-video items-center justify-center rounded-sm text-sm">
              Clip not available on this machine
            </div>
          )}

          {incident.has_clip && evidenceSeconds.length > 0 && (
            <div className="mt-3 grid grid-cols-4 gap-2">
              {evidenceSeconds.map((second) => (
                <figure key={second} className="min-w-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={frameUrl(incident, second)}
                    alt={`Screen at ${formatSeconds(second)}`}
                    className={cn(
                      "aspect-video w-full rounded-sm border object-cover object-top",
                      second === failingSecond
                        ? "border-danger"
                        : "border-line",
                    )}
                  />
                  <figcaption
                    className={cn(
                      "mt-1 text-center text-[11px] tabular-nums",
                      second === failingSecond
                        ? "text-danger font-semibold"
                        : "text-ink-faint",
                    )}
                  >
                    {formatSeconds(second)}
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
        </div>
      </div>

      {showDetails && (
        <div className="border-line bg-canvas grid gap-4 border-t px-5 py-4 text-sm lg:grid-cols-2 lg:px-6">
          <div>
            <p className="text-ink-faint text-[11px] font-medium tracking-wide uppercase">
              Engineer summary
            </p>
            <p className="text-ink-muted mt-1 leading-relaxed">
              {incident.summary}
            </p>
            {finding?.observed && (
              <>
                <p className="text-ink-faint mt-3 text-[11px] font-medium tracking-wide uppercase">
                  What the screen showed
                </p>
                <p className="text-ink-muted mt-1 leading-relaxed">
                  {finding.observed}
                </p>
              </>
            )}
          </div>
          <div>
            {review && (
              <>
                <p className="text-ink-faint text-[11px] font-medium tracking-wide uppercase">
                  Strongest counterargument, {review.verdict}ed at{" "}
                  {Math.round(review.confidence * 100)}%
                </p>
                <p className="text-ink-muted mt-1 leading-relaxed">
                  {review.counterargument}
                </p>
              </>
            )}
            <dl className="text-ink-muted mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
              <dt>Incident</dt>
              <dd className="font-mono">{incident.incident_id}</dd>
              <dt>Session</dt>
              <dd className="font-mono">{shortId(incident.session_id)}</dd>
              {incident.fingerprint && (
                <>
                  <dt>Fingerprint</dt>
                  <dd className="font-mono">{incident.fingerprint}</dd>
                </>
              )}
              <dt>Sessions affected</dt>
              <dd className="tabular-nums">{incident.affected_users}</dd>
            </dl>
          </div>
        </div>
      )}
    </article>
  );
}
