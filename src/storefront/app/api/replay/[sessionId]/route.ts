import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import type { eventWithTime } from "rrweb";

export const runtime = "nodejs";

const sessionIdPattern = /^[A-Za-z0-9-]{8,64}$/;
const headers = { "Cache-Control": "no-store" };

function errorResponse(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers });
}

async function fetchIngestReplay(sessionId: string) {
  const ingestUrl = process.env.INGEST_URL?.replace(/\/$/, "");
  if (!ingestUrl) return null;
  try {
    const response = await fetch(
      `${ingestUrl}/replay/${encodeURIComponent(sessionId)}`,
      {
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (response.status === 404) return null;
    if (response.status === 413) {
      return errorResponse(
        "This recording exceeds the agent's replay event limit.",
        413,
      );
    }
    if (!response.ok) {
      return errorResponse(
        "The ingest service could not load this recording. Check the service and Elasticsearch connection, then retry.",
        502,
      );
    }
    const body = await response.json();
    if (!Array.isArray(body.events) || !body.events.every(isEvent)) {
      return errorResponse(
        "The ingest service returned an invalid recording.",
        502,
      );
    }
    if (
      body.events.length < 2 ||
      !body.events.some((event: eventWithTime) => event.type === 2)
    ) {
      return errorResponse(
        "The recording does not yet contain a full page snapshot. Wait for the next batch and retry.",
        422,
      );
    }
    return NextResponse.json({ sessionId, events: body.events }, { headers });
  } catch {
    return errorResponse(
      "The ingest service is unavailable. Start eyewitness ingest or check INGEST_URL, then retry.",
      502,
    );
  }
}

function isEvent(value: unknown): value is eventWithTime {
  if (!value || typeof value !== "object") return false;
  const event = value as Partial<eventWithTime>;
  return (
    typeof event.type === "number" &&
    Number.isInteger(event.type) &&
    event.type >= 0 &&
    event.type <= 6 &&
    typeof event.timestamp === "number" &&
    Number.isFinite(event.timestamp) &&
    typeof event.data === "object" &&
    event.data !== null
  );
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;
  // Match the recording sink's allowlist before constructing a filesystem path.
  if (!sessionIdPattern.test(sessionId)) {
    return errorResponse(
      "Invalid session id. Use 8–64 letters, numbers, or hyphens.",
      400,
    );
  }

  const path = join(process.cwd(), ".data", "replay", `${sessionId}.ndjson`);
  let contents: string;
  try {
    if ((await stat(path)).size > 50 * 1024 * 1024) {
      return errorResponse(
        "This recording exceeds the local viewer's 50 MB limit.",
        413,
      );
    }
    contents = await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      const remote = await fetchIngestReplay(sessionId);
      if (remote) return remote;
      return errorResponse(
        "No recording found. Check the session id and wait five seconds for a batch to flush. For agent recordings, configure INGEST_URL; for local recordings, leave NEXT_PUBLIC_REPLAY_ENDPOINT blank.",
        404,
      );
    }
    return errorResponse("The local recording could not be read.", 500);
  }

  const events: eventWithTime[] = [];
  const lines = contents.split("\n");
  for (let index = 0; index < lines.length; index++) {
    if (!lines[index].trim()) continue;
    try {
      // The sink writes a ReplayBatch per line, not an individual rrweb event.
      const batch = JSON.parse(lines[index]);
      if (
        !batch ||
        batch.sessionId !== sessionId ||
        !Array.isArray(batch.events) ||
        !batch.events.every(isEvent)
      ) {
        throw new Error("Invalid batch");
      }
      for (const event of batch.events) events.push(event);
    } catch {
      return errorResponse(
        `Recording batch ${index + 1} is incomplete or malformed. Retry after recording finishes.`,
        422,
      );
    }
  }

  if (events.length < 2 || !events.some((event) => event.type === 2)) {
    return errorResponse(
      "The recording does not yet contain a full page snapshot. Record a new page visit and retry after five seconds.",
      422,
    );
  }

  events.sort((left, right) => left.timestamp - right.timestamp);
  return NextResponse.json({ sessionId, events }, { headers });
}
