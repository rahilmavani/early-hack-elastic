import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import type { ReplayBatch } from "@/lib/telemetry/replay";

const replayDir = join(process.cwd(), ".data", "replay");
const sessionIdPattern = /^[A-Za-z0-9-]{8,64}$/;

function isReplayBatch(body: unknown): body is ReplayBatch {
  if (typeof body !== "object" || body === null) {
    return false;
  }
  const candidate = body as Partial<ReplayBatch>;
  return (
    typeof candidate.sessionId === "string" &&
    sessionIdPattern.test(candidate.sessionId) &&
    Array.isArray(candidate.events)
  );
}

export async function POST(request: Request) {
  const text = await request.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!isReplayBatch(body)) {
    return NextResponse.json({ error: "Invalid batch" }, { status: 400 });
  }

  await mkdir(replayDir, { recursive: true });
  await appendFile(
    join(replayDir, `${body.sessionId}.ndjson`),
    `${JSON.stringify(body)}\n`,
  );

  return new Response(null, { status: 204 });
}
