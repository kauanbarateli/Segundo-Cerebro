// Pure, bounded projection. Never read error.message or stringify the error.
import { captureOrigin } from "./capture-policy.mjs";

const PREFIX = "CAPTURE_PAGE_ERROR_DETAIL ";
const MAX_WIRE = 256, MAX_STACK = 16_384, MAX_LINES = 40, MAX_LOCATION = 9_999_999;
const classes = new Set(["Error", "EvalError", "RangeError", "ReferenceError", "SyntaxError", "TypeError", "URIError", "AggregateError", "Unknown"]);
const basename = /^(?:(?:[a-f0-9]{8}|[0-9]{1,6}|webpack|main-app|framework|polyfills)-[a-f0-9]{16}|[a-f0-9]{16}|(?:page|layout|global-error)-[a-f0-9]{16})\.js$/u;
const directories = new Set(["", "app/", "app/(workspace)/", "app/(workspace)/projetos/", "app/_not-found/"]);
const unknown = () => Object.freeze({ version: 1, errorClass: "Unknown", frame: null });
const location = value => Number.isSafeInteger(value) && value > 0 && value <= MAX_LOCATION;

// Accessors are refused, not called. A hostile/revoked Proxy may throw from a
// reflection trap; the caller still receives a closed fallback. No coercion.
function dataProperty(value, key, depth) {
  if (!value || !["object", "function"].includes(typeof value)) return undefined;
  try {
    for (let count = 0; value && count < depth; count++, value = Object.getPrototypeOf(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor) return Object.hasOwn(descriptor, "value") ? descriptor.value : undefined;
    }
  } catch { /* A diagnostic must not replace the original fatal error. */ }
  return undefined;
}

// Returned paths are private in-memory inventory keys, never output fields.
export function publicNextChunk(raw, base) {
  try {
    if (typeof base !== "string" || captureOrigin(base) !== base || typeof raw !== "string" || raw.length > 512
      || !raw.startsWith(base + "/_next/static/chunks/") || /[%?#\\\s\u0000-\u001f\u007f]/u.test(raw)) return null;
    const suffix = raw.slice((base + "/_next/static/chunks/").length), slash = suffix.lastIndexOf("/");
    const directory = suffix.slice(0, slash + 1), chunk = suffix.slice(slash + 1);
    if (!directories.has(directory) || !basename.test(chunk)) return null;
    const parsed = new URL(raw);
    if (parsed.origin !== base || parsed.href !== raw || parsed.username || parsed.password) return null;
    return Object.freeze({ path: parsed.pathname, chunk });
  } catch { return null; }
}

function firstFrame(stack, base, publicChunks) {
  if (typeof stack !== "string" || stack.length > MAX_STACK || !Array.isArray(publicChunks) || publicChunks.length > 256) return null;
  const lines = stack.split("\n");
  if (lines.length > MAX_LINES) return null;
  // The first line is the error header. It is never classified or reflected.
  for (const line of lines.slice(1)) {
    // Only canonical V8 frame lines; names/paths outside the URL are discarded.
    const match = /^    at (http:\/\/\S{1,512}):([1-9][0-9]{0,6}):([1-9][0-9]{0,6})$/u.exec(line)
      ?? /^    at [^()\r\n]{1,80} \((http:\/\/\S{1,512}):([1-9][0-9]{0,6}):([1-9][0-9]{0,6})\)$/u.exec(line);
    if (!match) continue;
    const asset = publicNextChunk(match[1], base), row = Number(match[2]), column = Number(match[3]);
    if (asset && publicChunks.includes(asset.path) && location(row) && location(column)) return Object.freeze({ chunk: asset.chunk, line: row, column });
  }
  return null;
}

export function capturePageErrorDiagnostic(error, base, publicChunks = []) {
  try {
    const name = dataProperty(error, "name", 4);
    const errorClass = typeof name === "string" && classes.has(name) ? name : "Unknown";
    return Object.freeze({ version: 1, errorClass, frame: firstFrame(dataProperty(error, "stack", 1), base, publicChunks) });
  } catch { return unknown(); }
}

// Trusted Playwright event boundary only. Native Error.stack is an accessor on
// Node24; materialize name/stack once, never message/cause or arbitrary coercion.
// The general projection above remains descriptor-only for untrusted records.
export function captureSdkPageErrorDiagnostic(error, base, publicChunks = []) {
  let metadata = null;
  try {
    const name = error.name, stack = error.stack;
    metadata = { name: typeof name === "string" && name.length <= 32 ? name : undefined,
      stack: typeof stack === "string" && stack.length <= MAX_STACK ? stack : undefined };
  } catch { /* The handler already recorded fatal PAGE_ERROR; keep Unknown/null. */ }
  return capturePageErrorDiagnostic(metadata, base, publicChunks);
}
function closedDiagnostic(value) {
  const exact = (object, keys) => object && typeof object === "object" && !Array.isArray(object)
    && Object.keys(object).sort().join("|") === keys.slice().sort().join("|");
  if (!exact(value, ["version", "errorClass", "frame"])) return null;
  const version = dataProperty(value, "version", 1), errorClass = dataProperty(value, "errorClass", 1), frame = dataProperty(value, "frame", 1);
  if (version !== 1 || !classes.has(errorClass)) return null;
  if (frame === null) return Object.freeze({ version: 1, errorClass, frame: null });
  if (!exact(frame, ["chunk", "line", "column"])) return null;
  const chunk = dataProperty(frame, "chunk", 1), row = dataProperty(frame, "line", 1), column = dataProperty(frame, "column", 1);
  if (typeof chunk !== "string" || !basename.test(chunk) || !location(row) || !location(column)) return null;
  return Object.freeze({ version: 1, errorClass, frame: Object.freeze({ chunk, line: row, column }) });
}
// Only called with our frozen projection, never with the provider error.
export function pageErrorDiagnosticLine(diagnostic) {
  try { return PREFIX + JSON.stringify(closedDiagnostic(diagnostic) ?? unknown()); } catch { return PREFIX + JSON.stringify(unknown()); }
}

// One bounded reader per child stream. Only capture stderr enables detail.
// Protocol-like lines never enter the legacy code regex, even when malformed.
export function createPageErrorDiagnosticReader(acceptPageError = false) {
  let line = "", oversized = false, ended = false;
  const codes = new Set();
  let result = Object.freeze({ status: "missing", diagnostic: null });
  const refuse = () => { result = Object.freeze({ status: "refused", diagnostic: null }); };
  function complete(partial = false) {
    if (line.includes("CAPTURE_PAGE_ERROR_DETAIL")) {
      if (!acceptPageError || result.status !== "missing") return;
      if (partial || oversized || !line.startsWith(PREFIX)) { refuse(); return; }
      try {
        const body = line.slice(PREFIX.length), value = closedDiagnostic(JSON.parse(body));
        if (!value || JSON.stringify(value) !== body) { refuse(); return; }
        result = Object.freeze({ status: "accepted", diagnostic: value });
      } catch { refuse(); }
    } else if (!oversized) {
      for (const match of line.matchAll(/\b(?:CAPTURE_[A-Z_]{1,60}|EADDRINUSE|EACCES|ENOENT)\b/gu)) if (codes.size < 8) codes.add(match[0]);
    }
  }
  return Object.freeze({
    write(chunk) {
      if (ended || typeof chunk !== "string") return;
      for (let index = 0; index < chunk.length; index++) {
        const character = chunk[index];
        if (character === "\n") { complete(); line = ""; oversized = false; }
        else if (line.length < MAX_WIRE) line += character;
        else oversized = true;
      }
    },
    end() { if (!ended) complete(true); ended = true; line = ""; return result; },
    snapshot() { return result; },
    codes() { return Object.freeze([...codes]); },
  });
}

export function pageErrorDiagnosticForReport(role, firstCode, state) {
  if (role !== "capture" || firstCode !== "CAPTURE_PAGE_ERROR") return null;
  try {
    const status = dataProperty(state, "status", 1), diagnostic = dataProperty(state, "diagnostic", 1);
    if (status === "accepted") {
      const value = closedDiagnostic(diagnostic);
      if (value) return Object.freeze({ status, diagnostic: value });
    } else if (["missing", "refused"].includes(status) && diagnostic === null) return Object.freeze({ status, diagnostic: null });
  } catch { /* Refuse an invalid projection without publishing its input. */ }
  return Object.freeze({ status: "refused", diagnostic: null });
}
