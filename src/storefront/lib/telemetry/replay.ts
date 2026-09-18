import { record, type eventWithTime } from "rrweb";

export const routeChangeTag = "route";

let recording = false;

// Next.js client navigations never reload the page, so rrweb sees no new
// page event. This marks each route change explicitly for the agent.
export function markRouteChange(pathname: string) {
  if (!recording) {
    return;
  }
  record.addCustomEvent(routeChangeTag, { path: pathname });
}

type ReplayOptions = {
  sessionId: string;
  endpoint: string;
  flushIntervalMs?: number;
};

export type ReplayBatch = {
  sessionId: string;
  sentAt: string;
  events: eventWithTime[];
};

// Browsers cap sendBeacon and keepalive payloads at 64 KB, so the unload
// flush has to be split into small batches. The periodic flush has no limit.
const beaconLimitBytes = 60_000;

function serialise(sessionId: string, events: eventWithTime[]) {
  const batch: ReplayBatch = {
    sessionId,
    sentAt: new Date().toISOString(),
    events,
  };
  return JSON.stringify(batch);
}

function chunkForBeacon(sessionId: string, events: eventWithTime[]) {
  const chunks: string[] = [];
  let current: eventWithTime[] = [];

  for (const event of events) {
    const candidate = [...current, event];
    if (
      current.length > 0 &&
      serialise(sessionId, candidate).length > beaconLimitBytes
    ) {
      chunks.push(serialise(sessionId, current));
      current = [event];
    } else {
      current = candidate;
    }
  }

  if (current.length > 0) {
    chunks.push(serialise(sessionId, current));
  }
  return chunks;
}

export function startReplayRecording({
  sessionId,
  endpoint,
  flushIntervalMs = 5000,
}: ReplayOptions) {
  let buffer: eventWithTime[] = [];

  function takeEvents() {
    const events = buffer;
    buffer = [];
    return events;
  }

  function flush() {
    const events = takeEvents();
    if (events.length === 0) {
      return;
    }
    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: serialise(sessionId, events),
    }).catch(() => {
      // A lost batch is acceptable; the next flush carries on.
    });
  }

  function flushWithBeacon() {
    const events = takeEvents();
    if (events.length === 0) {
      return;
    }
    for (const chunk of chunkForBeacon(sessionId, events)) {
      const body = new Blob([chunk], { type: "text/plain" });
      if (!navigator.sendBeacon(endpoint, body)) {
        break;
      }
    }
  }

  function handleVisibilityChange() {
    if (document.visibilityState === "hidden") {
      flushWithBeacon();
    }
  }

  const stopRecording = record({
    emit(event) {
      buffer.push(event);
    },
    maskInputOptions: { password: true },
    sampling: { mousemove: 50, scroll: 150 },
  });

  recording = true;
  markRouteChange(window.location.pathname);

  const timer = window.setInterval(flush, flushIntervalMs);
  window.addEventListener("pagehide", flushWithBeacon);
  document.addEventListener("visibilitychange", handleVisibilityChange);

  return function stop() {
    window.clearInterval(timer);
    window.removeEventListener("pagehide", flushWithBeacon);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    stopRecording?.();
    recording = false;
    flush();
  };
}
