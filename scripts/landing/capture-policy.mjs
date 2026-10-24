// Pure capture policy: no browser, filesystem, environment or network access.
const assetDirectory = "src/components/features/conheca/telas";
const names = Object.freeze([
  "inicio", "inicio-celular", "inicio-celular-dia", "financeiro", "financeiro-celular",
  "habitos", "habitos-celular", "projeto", "projeto-celular", "capturar", "capturar-celular",
  "busca", "busca-celular", "cofre", "cofre-celular",
]);
const hasControls = (value) => [...value].some((character) => character.charCodeAt(0) <= 32 || character.charCodeAt(0) === 127);
export const projectRoute = "/projetos?project=project-sc-v2";
export const projectReceipt = "docs/implementation/evidence/landing-project-capture.json";

function refuse(code) { throw new Error(code); }

export function parseCaptureOptions(args) {
  let base = "http://127.0.0.1:3110";
  let mode = "all";
  const seen = new Set();
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    if (!["--base", "--only", "--og"].includes(flag) || seen.has(flag)) refuse("CAPTURE_ARGUMENTS");
    seen.add(flag);
    if (flag === "--og") { mode = "og"; continue; }
    const value = args[++index];
    if (typeof value !== "string" || value.startsWith("--")) refuse("CAPTURE_ARGUMENTS");
    if (flag === "--base") base = value;
    else if (value === "projeto") mode = "projeto";
    else refuse("CAPTURE_ONLY_SCOPE");
  }
  if (seen.has("--only") && seen.has("--og")) refuse("CAPTURE_ARGUMENTS");
  return Object.freeze({ mode, base: captureOrigin(base) });
}

export function captureOrigin(value) {
  // Deliberately reject alternate IPv4 forms, DNS suffixes, IPv6 and URL paths.
  if (typeof value !== "string" || hasControls(value)
    || !/^http:\/\/(?:127\.0\.0\.1|localhost)(?::[0-9]{1,5})?\/?$/u.test(value)) refuse("CAPTURE_BASE");
  const url = new URL(value);
  if (url.port && (Number(url.port) < 1 || Number(url.port) > 65535)) refuse("CAPTURE_BASE");
  if (/:0\/?$/u.test(value)) refuse("CAPTURE_BASE");
  return url.origin;
}

function decodedPath(value) {
  let decoded = value;
  for (let depth = 0; depth < 5 && decoded.includes("%"); depth++) {
    try { decoded = decodeURIComponent(decoded); } catch { refuse("CAPTURE_REQUEST_PATH"); }
  }
  if (decoded.includes("%") || hasControls(decoded) || decoded.includes("\\")) refuse("CAPTURE_REQUEST_PATH");
  // Normalize encoded dot segments and duplicate slashes before checking /api.
  const parts = [];
  for (const part of decoded.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return `/${parts.join("/")}`.toLowerCase();
}

function safeUrl(raw, origin) {
  if (typeof raw !== "string" || hasControls(raw) || raw.length > 8192 || raw.includes("\\")) refuse("CAPTURE_REQUEST_URL");
  const url = new URL(raw, origin);
  if (url.origin !== origin || url.protocol !== "http:" || url.username || url.password || url.hash) refuse("CAPTURE_REQUEST_ORIGIN");
  const pathname = decodedPath(url.pathname);
  if (pathname === "/api" || pathname.startsWith("/api/")) refuse("CAPTURE_REQUEST_API");
  return { url, pathname };
}

export function decideCaptureRequest({ url, method }, base) {
  try {
    const origin = captureOrigin(base);
    if (method !== "GET") refuse("CAPTURE_REQUEST_METHOD");
    const parsed = safeUrl(url, origin);
    // The local image optimizer can otherwise proxy an external or API URL.
    if (parsed.pathname === "/_next/image") {
      const targets = parsed.url.searchParams.getAll("url");
      if (targets.length !== 1 || !targets[0]) refuse("CAPTURE_IMAGE_TARGET");
      const target = safeUrl(targets[0], origin);
      if (target.pathname === "/_next/image") refuse("CAPTURE_IMAGE_TARGET");
    }
    return Object.freeze({ allowed: true });
  } catch {
    // Never echo a URL, query, body or authorization header to the runner.
    return Object.freeze({ allowed: false });
  }
}

export function assertProjectTarget(raw, base) {
  const origin = captureOrigin(base);
  const url = new URL(raw);
  if (url.origin !== origin || url.username || url.password || url.hash
    || url.pathname !== "/projetos" || url.searchParams.size !== 1
    || url.searchParams.getAll("project").length !== 1
    || url.searchParams.get("project") !== "project-sc-v2") refuse("CAPTURE_PROJECT_TARGET");
  return projectRoute;
}

export function captureFile(mode, name, theme) {
  if (!["all", "projeto"].includes(mode) || !["light", "dark"].includes(theme)
    || !names.includes(name) || (mode === "projeto" && !["projeto", "projeto-celular"].includes(name))) refuse("CAPTURE_OUTPUT_SCOPE");
  return `${assetDirectory}/${name}${theme === "dark" ? "-escuro" : ""}.webp`;
}

export function projectFiles() {
  return Object.freeze(["light", "dark"].flatMap((theme) => ["projeto", "projeto-celular"].map((name) => captureFile("projeto", name, theme))));
}

export function assertCaptureSource({ sha, tree, expectedSha, clean, mode }) {
  if (mode !== "demo" || clean !== true || sha?.length !== 40 || tree?.length !== 40
    || !/^[a-f0-9]{40}$/u.test(sha ?? "") || !/^[a-f0-9]{40}$/u.test(tree ?? "")
    || (expectedSha !== undefined && expectedSha !== sha)) refuse("CAPTURE_SOURCE");
  return Object.freeze({ sha, tree });
}

export function assertProjectRecords(records) {
  const expected = projectFiles();
  if (!Array.isArray(records) || records.length !== expected.length
    || records.some((record, index) => record.file !== expected[index]
      || record.sidecar !== `${record.file}.json`
      || record.sha256?.length !== 64 || record.sidecarSha256?.length !== 64
      || !/^[a-f0-9]{64}$/u.test(record.sha256 ?? "")
      || !/^[a-f0-9]{64}$/u.test(record.sidecarSha256 ?? ""))) refuse("CAPTURE_PROJECT_RECORDS");
}

// Successful later observations cannot erase a failed load/page in this capture.
export function captureHealthAfter(previous, observation) {
  if (!Number.isSafeInteger(previous) || previous < 0 || previous === Number.MAX_SAFE_INTEGER) refuse("CAPTURE_HEALTH");
  if (["requestfailed", "pageerror", "unexpectedPage"].includes(observation?.kind)) return previous + 1;
  if (observation?.kind !== "http" || !Number.isInteger(observation.status)
    || observation.status < 100 || observation.status > 599) refuse("CAPTURE_HEALTH");
  return observation.status >= 400 ? previous + 1 : previous;
}

// One explicit newPage request may admit one page event, once per fresh context.
export function advanceCapturePageGate(state, event) {
  if (!["unused", "opening", "claimed"].includes(state)) refuse("CAPTURE_PAGE_GATE");
  if (event === "request") {
    if (state !== "unused") refuse("CAPTURE_PAGE_GATE");
    return Object.freeze({ state: "opening", allowed: true });
  }
  if (event !== "page") refuse("CAPTURE_PAGE_GATE");
  return Object.freeze({ state: state === "opening" ? "claimed" : state, allowed: state === "opening" });
}
