"use client";

import { useEffect } from "react";
import { getSessionId } from "@/lib/telemetry/session";

const replayEndpoint = process.env.NEXT_PUBLIC_REPLAY_ENDPOINT || "/api/replay";

export function TelemetryProvider() {
  useEffect(() => {
    const sessionId = getSessionId();
    let stopReplay: (() => void) | undefined;
    let cancelled = false;

    import("@/lib/telemetry/replay").then(({ startReplayRecording }) => {
      if (cancelled) {
        return;
      }
      stopReplay = startReplayRecording({
        sessionId,
        endpoint: replayEndpoint,
      });
    });

    return () => {
      cancelled = true;
      stopReplay?.();
    };
  }, []);

  return null;
}
