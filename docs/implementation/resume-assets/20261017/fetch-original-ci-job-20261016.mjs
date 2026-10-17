import { isUtf8 } from "node:buffer";

// Explicit JOB transport, never an automatic fallback from a step request.
// Caller qualifies SHA/run/attempt/job AND the original step window separately.
// No gh command, cache, disk IO or diagnostic output; caller erases the Buffer.
// https://docs.github.com/en/rest/actions/workflow-jobs#download-job-logs-for-a-workflow-run
const CODE = "ORIGINAL_CI_JOB_LOGS_REFUSED", failures = new WeakMap();
const inputFacts = Object.freeze({ phase: "arguments", apiStatus: null, receiverStatus: null,
  redirectCategory: "absent", contentTypeCategory: "absent", reasonCode: "INPUT_REFUSED" });
const closedError = facts => { const error = new Error(CODE); failures.set(error, Object.freeze(facts)); return error; };
const inputFail = () => { throw closedError(inputFacts); };
const status = value => Number.isSafeInteger(value) && value >= 100 && value <= 599 ? value : null;
const category = value => {
  if (value === null) return "absent";
  const media = value.split(";", 1)[0].trim().toLowerCase();
  return media === "text/plain" ? "text" : media === "application/octet-stream" ? "octet" : "other";
};

export const originalJobLogsFailure = error => failures.get(error) ?? null;
export function jobLogLocation(value) {
  let url; try { url = new URL(value); } catch { inputFail(); }
  if (url.protocol !== "https:" || url.username || url.password || url.port || url.hash ||
      !(/^[a-z0-9-]+\.blob\.core\.windows\.net$/.test(url.hostname) ||
        url.hostname === "results-receiver.actions.githubusercontent.com")) inputFail();
  return url.href;
}

export async function fetchOriginalJobLogs(jobId, token, options = {}) {
  let fetcher, timeoutMs, maxBytes;
  try {
    if (!options || typeof options !== "object" || Array.isArray(options)) inputFail();
    ({ fetcher = fetch, timeoutMs = 45000, maxBytes = 32 * 1024 * 1024 } = options);
  } catch { inputFail(); }
  if (!Number.isSafeInteger(jobId) || jobId < 1 || typeof token !== "string" ||
      token.length < 10 || token.length > 2048 || /[^\x21-\x7e]/.test(token) ||
      typeof fetcher !== "function" || !Number.isSafeInteger(timeoutMs) ||
      timeoutMs < 1 || timeoutMs > 45000 || !Number.isSafeInteger(maxBytes) ||
      maxBytes < 1 || maxBytes > 32 * 1024 * 1024) inputFail();

  const controller = new AbortController(), deadline = performance.now() + timeoutMs;
  const responses = new Set();
  let closed = false, reader, storage, bytes = 0, rejectTimeout, firstFailure;
  let phase = "api", apiStatus = null, receiverStatus = null;
  let redirectCategory = "absent", contentTypeCategory = "absent";
  const remember = reasonCode => {
    firstFailure ??= closedError({ phase, apiStatus, receiverStatus, redirectCategory, contentTypeCategory, reasonCode });
    return firstFailure;
  };
  const refuse = reasonCode => { throw remember(reasonCode); };
  const expired = () => closed || controller.signal.aborted || performance.now() >= deadline;
  const check = () => { if (expired()) refuse("DEADLINE_REFUSED"); };
  const timed = new Promise((_, reject) => { rejectTimeout = reject; }); timed.catch(() => {});
  const timer = setTimeout(() => {
    const error = remember("DEADLINE_REFUSED"); controller.abort(); rejectTimeout(error);
  }, timeoutMs);
  const observeCancellation = value => { try { Promise.resolve(value).catch(() => {}); } catch { /* Closed result. */ } };
  const discardResponse = response => {
    try { if (response?.body && !response.body.locked) observeCancellation(response.body.cancel()); }
    catch { /* Cancellation cannot certify EOF. */ }
  };
  const eraseItem = item => { try { if (item?.value instanceof Uint8Array) item.value.fill(0); } catch { /* Best effort. */ } };
  const wait = async (promise, dispose) => {
    const result = await Promise.race([promise, timed]);
    if (expired()) { dispose?.(result); refuse("DEADLINE_REFUSED"); }
    return result;
  };
  const request = async (url, settings) => {
    check();
    const pending = Promise.resolve().then(() => { check(); return fetcher(url, settings); }).then(response => {
      if (expired()) { discardResponse(response); refuse("DEADLINE_REFUSED"); }
      responses.add(response); return response;
    });
    return wait(pending);
  };
  try {
    storage = Buffer.allocUnsafe(maxBytes);
    const endpoint = "https://api.github.com/repos/kauanbarateli/Segundo-Cerebro/actions/jobs/" + jobId + "/logs";
    const initial = await request(endpoint, {
      method: "GET", redirect: "manual", cache: "no-store", credentials: "omit", signal: controller.signal,
      headers: { Accept: "application/vnd.github+json", Authorization: "Bearer " + token, "X-GitHub-Api-Version": "2026-03-10" },
    });
    apiStatus = status(initial.status);
    if (apiStatus !== 302 || initial.redirected !== false) refuse("API_STATUS_REFUSED");
    phase = "redirect";
    const location = initial.headers.get("location"); let destination;
    try { destination = jobLogLocation(location); }
    catch { redirectCategory = location === null ? "absent" : "other"; refuse("REDIRECT_REFUSED"); }
    redirectCategory = new URL(destination).hostname.endsWith(".blob.core.windows.net") ? "blob" : "actions";
    discardResponse(initial);
    phase = "receiver";
    const response = await request(destination, {
      method: "GET", redirect: "error", cache: "no-store", credentials: "omit", signal: controller.signal,
      headers: { Accept: "text/plain" },
    });
    receiverStatus = status(response.status);
    if (receiverStatus !== 200 || response.redirected !== false || !response.body?.getReader) refuse("RECEIVER_STATUS_REFUSED");
    contentTypeCategory = category(response.headers.get("content-type"));
    if (!["text", "octet"].includes(contentTypeCategory)) refuse("CONTENT_TYPE_REFUSED");
    const length = response.headers.get("content-length");
    if (length !== null && (!/^\d+$/.test(length) || Number(length) > maxBytes)) refuse("LENGTH_REFUSED");
    phase = "body"; reader = response.body.getReader();
    while (true) {
      check();
      const pending = Promise.resolve().then(() => { check(); return reader.read(); }).then(item => {
        if (expired()) { eraseItem(item); refuse("DEADLINE_REFUSED"); } return item;
      });
      const item = await wait(pending, eraseItem);
      try {
        if (!item || typeof item.done !== "boolean") refuse("BODY_REFUSED");
        if (item.done) { if (item.value !== undefined) refuse("BODY_REFUSED"); break; }
        if (!(item.value instanceof Uint8Array)) refuse("BODY_REFUSED");
        if (item.value.byteLength > maxBytes - bytes) refuse("LIMIT_REFUSED");
        storage.set(item.value, bytes); bytes += item.value.byteLength;
      } finally { eraseItem(item); }
    }
    check(); phase = "encoding";
    if (bytes === 0 || !isUtf8(storage.subarray(0, bytes))) refuse("ENCODING_REFUSED");
    return Buffer.from(storage.subarray(0, bytes));
  } catch { throw remember("PROVIDER_REFUSED"); }
  finally {
    closed = true; clearTimeout(timer); controller.abort(); storage?.fill(0);
    try { if (reader) observeCancellation(reader.cancel()); } catch { /* No terminal proof. */ }
    try { reader?.releaseLock(); } catch { /* Late read owns its erasure. */ }
    for (const response of responses) discardResponse(response); responses.clear();
  }
}
