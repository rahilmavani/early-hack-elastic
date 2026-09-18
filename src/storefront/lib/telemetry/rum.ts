import { init } from "@elastic/apm-rum";

type RumOptions = {
  serverUrl: string;
  sessionId: string;
};

export function startRum({ serverUrl, sessionId }: RumOptions) {
  const apm = init({
    serviceName: "storefront",
    serverUrl,
    environment: process.env.NODE_ENV,
    distributedTracingOrigins: [window.location.origin],
    breakdownMetrics: true,
  });

  // Every transaction carries the replay session id so a clip and a trace join on it.
  apm.addLabels({ session_id: sessionId });

  return apm;
}
