import { getSessionId } from "@/lib/telemetry/session";

export function apiFetch(input: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("x-session-id", getSessionId());
  return fetch(input, { ...init, headers });
}
