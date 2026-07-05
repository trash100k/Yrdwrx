// Structured logging for Cloud Run → Google Cloud Logging + Error Reporting.
//
// WHY no npm dependency: Cloud Run captures a container's stdout/stderr straight into Cloud
// Logging. If a written line is a single JSON object, Cloud Logging maps recognized fields
// (`severity`, `message`, `timestamp`, `httpRequest`, ...) onto the LogEntry automatically.
// Cloud **Error Reporting** additionally auto-ingests any log with `severity >= ERROR` that
// carries a stack trace (or the `ReportedErrorEvent` `@type`), grouping it into an alertable
// incident. So one well-shaped JSON line becomes an alertable error with zero SDK/agent.
//
// CONTRACT (do not break):
//   - Exactly ONE JSON object per physical line. JSON.stringify escapes embedded newlines,
//     so a multi-line stack stays on a single line — Cloud Logging splits on real newlines.
//   - DEBUG / INFO / WARNING  -> stdout ;  ERROR -> stderr.
//   - `severity` uses the Cloud Logging LogSeverity enum names (DEBUG/INFO/WARNING/ERROR).
//   - Messages are SERVER-SIDE only. Callers must keep client responses generic; nothing here
//     is sent to the browser.

import { randomUUID } from "crypto";

export type Severity = "DEBUG" | "INFO" | "WARNING" | "ERROR";

export interface LogFields {
  [key: string]: unknown;
}

// The type URL Error Reporting recognizes. An entry tagged with this + a stack trace in the
// `message`/`stack_trace` field is grouped as an error incident.
export const REPORTED_ERROR_TYPE =
  "type.googleapis.com/google.devtools.clouderrorreporting.v1beta1.ReportedErrorEvent";

// serviceContext lets Error Reporting group incidents by service + revision. Cloud Run injects
// K_SERVICE / K_REVISION; fall back to a stable product name so local errors still group.
const SERVICE_CONTEXT = {
  service: process.env.K_SERVICE || process.env.SERVICE_NAME || "yardworx",
  version: process.env.K_REVISION || process.env.SERVICE_VERSION || undefined,
};

// Derive a stack string for Error Reporting. Prefer a real Error's stack; otherwise synthesize
// one from the message so severity>=ERROR entries still get grouped (Error Reporting needs a
// stack-shaped payload).
function errorStack(err: unknown, fallbackMessage: string): string {
  if (err instanceof Error && err.stack) return err.stack;
  if (err && typeof err === "object") {
    const anyErr = err as { stack?: unknown; message?: unknown };
    if (typeof anyErr.stack === "string" && anyErr.stack) return anyErr.stack;
    if (typeof anyErr.message === "string" && anyErr.message) return `Error: ${anyErr.message}`;
  }
  if (typeof err === "string" && err) return `Error: ${err}`;
  return new Error(fallbackMessage).stack || `Error: ${fallbackMessage}`;
}

// Build the LogEntry object (pure — exported for tests). For ERROR it attaches the
// Error-Reporting shape (`@type`, stack in `message` + `stack_trace`, `serviceContext`).
export function buildEntry(
  severity: Severity,
  message: string,
  fields: LogFields = {},
  err?: unknown,
): Record<string, unknown> {
  const entry: Record<string, unknown> = {
    severity,
    message,
    timestamp: new Date().toISOString(),
    ...fields,
  };
  if (severity === "ERROR") {
    const stack = errorStack(err, message);
    entry["@type"] = REPORTED_ERROR_TYPE;
    // Error Reporting reads the full stack from `message`; keep a copy in `stack_trace` and the
    // human summary in `summary` so it's still legible in the Cloud Logging row.
    entry.message = err ? `${message}\n${stack}` : stack;
    entry.stack_trace = stack;
    entry.summary = message;
    entry.serviceContext = SERVICE_CONTEXT;
  }
  return entry;
}

// Thin IO seam so the emit path is testable without hijacking the real streams if desired.
function write(severity: Severity, line: string): void {
  if (severity === "ERROR") process.stderr.write(line + "\n");
  else process.stdout.write(line + "\n");
}

function emit(severity: Severity, message: string, fields?: LogFields, err?: unknown): void {
  try {
    write(severity, JSON.stringify(buildEntry(severity, message, fields, err)));
  } catch {
    // Logging must never throw into a request path (e.g. a value with a BigInt / circular ref).
    write(severity, `{"severity":"${severity}","message":${JSON.stringify(String(message))}}`);
  }
}

export const log = {
  debug(message: string, fields?: LogFields): void {
    emit("DEBUG", message, fields);
  },
  info(message: string, fields?: LogFields): void {
    emit("INFO", message, fields);
  },
  warn(message: string, fields?: LogFields): void {
    emit("WARNING", message, fields);
  },
  // `err` is the Error/thrown value whose stack should feed Error Reporting; `fields` are extra
  // structured context (requestId, tenantId, route, ...). Both optional.
  error(message: string, err?: unknown, fields?: LogFields): void {
    emit("ERROR", message, fields, err);
  },
};

// Short, unique-per-request correlation id. Attach to the response header + every log line for
// that request so a single request can be traced across Cloud Logging entries.
export function requestId(): string {
  try {
    return randomUUID();
  } catch {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
}
