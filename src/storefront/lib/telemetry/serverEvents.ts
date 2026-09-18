import { NextResponse } from "next/server";

const ingestUrl = process.env.INGEST_URL || "";

type RouteHandler = (request: Request) => Promise<NextResponse | Response>;

function sendServerEvent(event: Record<string, unknown>) {
  fetch(`${ingestUrl}/ingest/server-events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(event),
  }).catch(() => {
    // Telemetry must never break the request it describes.
  });
}

export function withServerEvent(
  route: string,
  handler: RouteHandler,
): RouteHandler {
  return async function tracedHandler(request: Request) {
    const startedAt = Date.now();
    const traceId = crypto.randomUUID();
    const response = await handler(request);
    response.headers.set("x-trace-id", traceId);

    const sessionId = request.headers.get("x-session-id");
    if (ingestUrl && sessionId) {
      sendServerEvent({
        sessionId,
        traceId,
        timestamp: new Date(startedAt).toISOString(),
        route,
        method: request.method,
        status: response.status,
        durationMs: Date.now() - startedAt,
      });
    }

    return response;
  };
}
