"use client";

import { useEffect, useRef, useState } from "react";
import type Player from "rrweb-player";
import "rrweb-player/dist/style.css";

// rrweb-player bundles Svelte, but does not ship Svelte's component base types.
type PlayerInstance = Player & {
  $set(props: { width: number; height: number }): void;
  $destroy(): void;
};

export function ReplayViewer({ sessionId }: { sessionId: string }) {
  const target = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const abort = new AbortController();
    let player: PlayerInstance | undefined;
    let observer: ResizeObserver | undefined;

    async function load() {
      try {
        const response = await fetch(
          `/api/replay/${encodeURIComponent(sessionId)}`,
          {
            signal: abort.signal,
            cache: "no-store",
          },
        );
        const body = await response.json();
        if (!response.ok)
          throw new Error(body.error || "Could not load this recording.");
        const { default: ReplayPlayer } = await import("rrweb-player");
        if (abort.signal.aborted || !target.current) return;
        const container = target.current;
        const width = Math.max(280, container.clientWidth);
        player = new ReplayPlayer({
          target: container,
          props: {
            events: body.events,
            width,
            height: Math.round((width * 9) / 16),
            autoPlay: false,
            showController: true,
          },
        }) as PlayerInstance;
        observer = new ResizeObserver(() => {
          const width = Math.max(280, container.clientWidth);
          player?.$set({ width, height: Math.round((width * 9) / 16) });
          player?.triggerResize();
        });
        observer.observe(container);
        setLoaded(true);
      } catch (error) {
        if (!abort.signal.aborted) {
          setError(
            error instanceof Error
              ? error.message
              : "Could not play this recording.",
          );
        }
      }
    }

    void load();
    return () => {
      abort.abort();
      observer?.disconnect();
      player?.getReplayer().destroy();
      player?.$destroy();
    };
  }, [sessionId, attempt]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-12 sm:px-8">
      <p className="text-ink-muted text-xs tracking-widest uppercase">
        Eyewitness
      </p>
      <h1 className="mt-2 text-3xl font-semibold">Session replay</h1>
      <p className="text-ink-muted mt-3 font-mono text-sm break-all">
        {sessionId}
      </p>
      <p className="text-ink-muted mt-3 text-sm">
        Play the recording or scrub the timeline to inspect what the shopper
        saw.
      </p>
      {error ? (
        <div
          role="alert"
          className="border-line bg-canvas-muted mt-8 rounded border p-6"
        >
          <h2 className="font-semibold">Replay unavailable</h2>
          <p className="text-ink-muted mt-2 text-sm">{error}</p>
          <button
            type="button"
            className="bg-ink mt-4 rounded px-4 py-2 text-sm text-white"
            onClick={() => {
              setError(null);
              setLoaded(false);
              setAttempt((value) => value + 1);
            }}
          >
            Retry
          </button>
        </div>
      ) : !loaded ? (
        <p role="status" className="text-ink-muted mt-8">
          Loading recording…
        </p>
      ) : null}
      <div
        ref={target}
        className="mt-8 min-w-0"
        aria-label="Session replay player"
      />
    </main>
  );
}
