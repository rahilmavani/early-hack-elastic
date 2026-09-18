export type SessionSignals = {
  dead_clicks?: number;
  rage_clicks?: number;
  repeated_submits?: number;
  checkout_abandoned?: boolean;
  bag_abandoned?: boolean;
  backend_error?: boolean;
  high_api_latency?: boolean;
  difficulty_score?: number;
  computed_at?: string;
};

export type SessionStatus =
  "unscored" | "healthy" | "flagged" | "cleared" | "confirmed" | "filed";

export type PlainLanguage = {
  headline?: string | null;
  step_tried?: string | null;
  step_expected?: string | null;
  step_got?: string | null;
};

export type Finding = PlainLanguage & {
  confirmed: boolean;
  stage_reached: string | null;
  title: string | null;
  page: string | null;
  user_intent: string | null;
  expected: string | null;
  observed: string | null;
  summary: string | null;
  failing_second: number | null;
  evidence_seconds: number[];
  triage_reason: string | null;
  triage_confidence: number | null;
  review_verdict: string | null;
  review_confidence: number | null;
  counterargument: string | null;
};

export type AdminSession = {
  session_id: string;
  started_at: number | string | null;
  last_batch_at: string | null;
  duration_ms: number;
  pages: string[];
  click_count: number;
  event_count: number;
  signals: SessionSignals;
  score: number | null;
  status: SessionStatus;
  has_clip: boolean;
  incident_id: string | null;
  case_url: string | null;
  finding: Finding | null;
};

export type Incident = PlainLanguage & {
  incident_id: string;
  created_at: string;
  last_seen_at?: string | null;
  last_seen_session_id?: string | null;
  status: string;
  title: string;
  summary: string;
  session_id: string;
  failing_second: number | null;
  clip_url: string | null;
  frame_urls: string[];
  route: string | null;
  status_code: number | null;
  affected_users: number;
  fingerprint: string | null;
  review: {
    verdict: string;
    counterargument: string;
    confidence: number;
  } | null;
  case_id: string | null;
  case_url: string | null;
  has_clip: boolean;
  finding: Finding | null;
};

export type RunOutcome = {
  session_id: string;
  difficulty_score: number;
  stage: string;
  confirmed: boolean;
  case_id: string | null;
  deduplicated: boolean;
  error: string | null;
};

export type RunStages = {
  swept: number;
  rendered: number;
  watched: number;
  confirmed: number;
  filed: number;
};

export type RunSummary = {
  run_id: string;
  started_at: string;
  swept: number;
  rendered: number;
  watched: number;
  confirmed: number;
  filed: number;
  deduplicated: number;
  cost_usd: number;
};

export type RunState = {
  run_id: string;
  status: "running" | "done" | "failed";
  started_at: string;
  finished_at: string | null;
  window: string;
  threshold: number;
  limit: number;
  swept: number | null;
  events: { at: string; message: string }[];
  summary: RunSummary | null;
  error: string | null;
  stages: RunStages;
  outcomes: RunOutcome[];
};

export type Impact = {
  open_incidents: number;
  sessions_hit: number;
  average_order_value: number;
  orders_measured: number;
  revenue_at_risk: number;
  median_detect_minutes: number | null;
  detect_samples: number;
  runs: number;
  sessions_watched: number;
  incidents_confirmed: number;
  total_cost_usd: number;
  cost_per_watched_usd: number | null;
  cost_per_confirmed_usd: number | null;
};

export function formatInr(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export const windows = [
  { value: "15m", label: "Last 15 min" },
  { value: "1h", label: "Last hour" },
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
] as const;

export type WindowValue = (typeof windows)[number]["value"];

export function shortId(id: string) {
  return id.slice(0, 8);
}

export function formatDuration(ms: number) {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? `${minutes}m ${rest}s` : `${minutes}m`;
}

export function formatClock(value: number | string | null | undefined) {
  if (value === null || value === undefined) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function formatSeconds(seconds: number | null | undefined) {
  if (seconds === null || seconds === undefined) return "—";
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

export function timeAgo(value: string | number | null | undefined) {
  if (value === null || value === undefined) return "";
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "";
  const seconds = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

// First sentence, or a word-boundary cut, for model text that has no short form.
export function clip(text: string | null | undefined, max = 90) {
  if (!text) return "";
  const sentence = text.split(/(?<=[.!?])\s/)[0];
  const candidate = sentence.length <= max ? sentence : text;
  if (candidate.length <= max) return candidate;
  const cut = candidate.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(" ") > 40 ? cut.lastIndexOf(" ") : max)}…`;
}

export function lastPage(pages: string[]) {
  return pages.length ? pages[pages.length - 1] : "/";
}

export const statusLabels: Record<
  SessionStatus,
  { label: string; className: string }
> = {
  unscored: {
    label: "Not checked yet",
    className: "bg-canvas-muted text-ink-muted",
  },
  healthy: { label: "Healthy", className: "bg-success/10 text-success" },
  flagged: { label: "Looks difficult", className: "bg-accent/10 text-accent" },
  cleared: { label: "AI says fine", className: "bg-canvas-muted text-ink" },
  confirmed: { label: "Broken", className: "bg-danger/10 text-danger" },
  filed: { label: "Ticket filed", className: "bg-danger text-white" },
};
