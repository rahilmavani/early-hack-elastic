import { NextResponse } from "next/server";

// Server-side proxy to the Eyewitness agent's admin API. Keeps INGEST_URL off
// the client and lets the admin page and its media use same-origin URLs.

export const runtime = "nodejs";

const ingestUrl = process.env.INGEST_URL?.replace(/\/$/, "");
const forwardedHeaders = [
  "content-type",
  "content-length",
  "content-range",
  "accept-ranges",
];

async function proxy(request: Request, path: string[]) {
  if (!ingestUrl) {
    return NextResponse.json(
      { error: "INGEST_URL is not configured for the storefront." },
      { status: 503 },
    );
  }

  const search = new URL(request.url).search;
  const target = `${ingestUrl}/admin/${path.map(encodeURIComponent).join("/")}${search}`;
  const headers = new Headers();
  const range = request.headers.get("range");
  if (range) headers.set("range", range);

  const init: RequestInit = {
    method: request.method,
    headers,
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  };
  if (request.method === "POST") {
    headers.set("content-type", "application/json");
    init.body = await request.text();
  }

  try {
    const upstream = await fetch(target, init);
    const responseHeaders = new Headers({ "cache-control": "no-store" });
    for (const name of forwardedHeaders) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "The Eyewitness service is not reachable. Start `eyewitness ingest` and retry.",
      },
      { status: 502 },
    );
  }
}

type Context = { params: Promise<{ path: string[] }> };

export async function GET(request: Request, { params }: Context) {
  const { path } = await params;
  return proxy(request, path);
}

export async function POST(request: Request, { params }: Context) {
  const { path } = await params;
  return proxy(request, path);
}
