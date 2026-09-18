import { faultStore } from "@/lib/faults/faultStore";
import { isFaultName } from "@/lib/faults/faults";
import { getSessionId } from "@/lib/telemetry/session";

export function apiFetch(input: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("x-session-id", getSessionId());
  const fault = faultStore.getSnapshot();
  if (fault && isFaultName(fault)) {
    headers.set("x-fault", fault);
  } else {
    headers.delete("x-fault");
  }
  return fetch(input, { ...init, headers });
}
