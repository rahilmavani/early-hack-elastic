"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { isObserverRoute } from "@/components/layout/StorefrontChrome";
import { getSessionId } from "@/lib/telemetry/session";

const replayEndpoint = process.env.NEXT_PUBLIC_REPLAY_ENDPOINT || "/api/replay";
const apmServerUrl = process.env.NEXT_PUBLIC_ELASTIC_APM_SERVER_URL || "";

export function TelemetryProvider() {
  const pathname = usePathname();
  // Observer surfaces must not record themselves as shopper sessions.
  const isReplayPage = isObserverRoute(pathname);

  useEffect(() => {
    if (isReplayPage) return;
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

    if (apmServerUrl) {
      import("@/lib/telemetry/rum").then(({ startRum }) => {
        if (!cancelled) {
          startRum({ serverUrl: apmServerUrl, sessionId });
        }
      });
    }

    return () => {
      cancelled = true;
      stopReplay?.();
    };
  }, [isReplayPage]);

  useEffect(() => {
    if (isReplayPage) return;
    import("@/lib/telemetry/replay").then(({ markRouteChange }) => {
      markRouteChange(pathname);
    });
  }, [pathname, isReplayPage]);

  return null;
}
