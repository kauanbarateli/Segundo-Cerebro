// Pure policy and a serializable browser initializer; no top-level I/O.
const assetDirectory = "src/components/features/conheca/telas";
const names = Object.freeze([
  "inicio", "inicio-celular", "inicio-celular-dia", "financeiro", "financeiro-celular",
  "habitos", "habitos-celular", "projeto", "projeto-celular", "capturar", "capturar-celular",
  "busca", "busca-celular", "cofre", "cofre-celular",
]);
const hasControls = (value) => [...value].some((character) => character.charCodeAt(0) <= 32 || character.charCodeAt(0) === 127);
export const projectRoute = "/projetos?project=project-sc-v2";
export const projectReceipt = "docs/implementation/evidence/landing-project-capture.json";
export const galleryReceipt = "landing-gallery-capture.json";
export const galleryScenes = Object.freeze([
  Object.freeze({ scene: "calendario-lista", route: "/calendario?view=list&date=2026-09-23", state: "calendar-list-demo-neutralized" }),
  Object.freeze({ scene: "tarefas-kanban", route: "/tarefas", state: "tasks-kanban-demo-neutralized" }),
]);

// Playwright also initializes blank documents and frames. Read storage only for
// the expected app origin; storage failures on that origin must still throw.
export function initializeDemoNavigationPolicy({ expectedOrigin, policy }) {
  const origin = globalThis.location.origin;
  if (origin === "null" || origin !== expectedOrigin) return;
  globalThis.sessionStorage.setItem("segundo-cerebro-demo-navigation-v1", policy);
}

// A blocked registration must also look unavailable to feature detection. This
// initializer is serialized only into capture-owned demo contexts, never the app.
export function initializeCaptureServiceWorkerPolicy({ expectedOrigin }) {
  try {
    const origin = globalThis.location.origin;
    if (origin === "null" || origin !== expectedOrigin) return;
    const local = typeof expectedOrigin === "string" && /^http:\/\/(?:127\.0\.0\.1|localhost)(?::([1-9][0-9]{0,4}))?$/u.exec(expectedOrigin);
    if (!local || local[1] && Number(local[1]) > 65535) throw new Error();
    const target = globalThis.navigator;
    if (!target || typeof target !== "object") throw new Error();
    const seen = new Set(), owners = [];
    for (let current = target; current !== null; current = Object.getPrototypeOf(current)) {
      if (seen.has(current) || seen.size >= 8) throw new Error();
      seen.add(current);
      const descriptor = Object.getOwnPropertyDescriptor(current, "serviceWorker");
      if (descriptor) {
        if (!descriptor.configurable) throw new Error();
        owners.push(current);
      }
    }
    // Preflight the complete bounded chain before removing any descriptor.
    for (const owner of owners) if (!Reflect.deleteProperty(owner, "serviceWorker")) throw new Error();
    if ("serviceWorker" in target) throw new Error();
  } catch { throw new Error("CAPTURE_SERVICE_WORKER_POLICY"); }
}

// Project registers this before app scripts; Gallery explicitly shares it below.
// Next AppRouter's visibility observer is optional; failed requests stay fatal.
export function initializeProjectPrefetchPolicy({ expectedOrigin }) {
  try {
    const origin = globalThis.location.origin;
    if (origin === "null" || origin !== expectedOrigin) return;
    const local = typeof expectedOrigin === "string" && /^http:\/\/(?:127\.0\.0\.1|localhost)(?::([1-9][0-9]{0,4}))?$/u.exec(expectedOrigin);
    if (!local || local[1] && Number(local[1]) > 65535) throw new Error();
    const target = globalThis, seen = new Set(), owners = [];
    for (let current = target; current !== null; current = Object.getPrototypeOf(current)) {
      if (seen.has(current) || seen.size >= 8) throw new Error();
      seen.add(current);
      const descriptor = Object.getOwnPropertyDescriptor(current, "IntersectionObserver");
      if (descriptor) {
        if (!descriptor.configurable) throw new Error();
        owners.push(current);
      }
    }
    // Preflight the complete bounded chain before the first deletion.
    for (const owner of owners) if (!Reflect.deleteProperty(owner, "IntersectionObserver")) throw new Error();
    if ("IntersectionObserver" in target || typeof target.IntersectionObserver !== "undefined"
      || typeof IntersectionObserver !== "undefined") throw new Error();
  } catch { throw new Error("CAPTURE_PROJECT_PREFETCH_POLICY"); }
}

// Browser query only; no wait, mutation, protocol line or getter invocation.
export function projectPrefetchPolicyAbsent() {
  try {
    return !("IntersectionObserver" in globalThis) && typeof globalThis.IntersectionObserver === "undefined"
      && typeof IntersectionObserver === "undefined";
  } catch { return false; }
}

// Same serialized initializer, explicitly opted into by Gallery only. The
// project registration and all/og behavior remain unchanged.
export const initializeGalleryPrefetchPolicy = initializeProjectPrefetchPolicy;

export function galleryReadyInPage(scene) {
  if (!["calendario-lista", "tarefas-kanban"].includes(scene)) throw new Error("CAPTURE_GALLERY_TARGET");
  if (document.querySelector("[role='alert']")) throw new Error("CAPTURE_GALLERY_ERROR");
  if (document.querySelector(".calendar-skeleton, .tasks-skeleton, [aria-busy='true'], [role='dialog']")) return false;
  if (document.querySelector(".shell-demo-label")?.textContent?.trim() !== "Demonstração"
    || document.fonts.status !== "loaded" || [...document.images].some(image => !image.complete || image.naturalWidth <= 0)) return false;
  const group = document.querySelector(scene === "calendario-lista" ? "[aria-label='Visão do calendário']" : "[aria-label='Visualização de tarefas']");
  const label = scene === "calendario-lista" ? "Lista" : "Kanban";
  if (!group || ![...group.querySelectorAll("button")].some(button => button.textContent?.trim() === label && button.getAttribute("aria-pressed") === "true")) return false;
  if (scene === "calendario-lista") {
    const list = document.querySelector(".calendar-list-view");
    return !!list && list.querySelector("h3")?.textContent?.trim() === "Próximos eventos"
      && list.querySelector("input[type='date']")?.value === "2026-09-23"
      && list.querySelectorAll(".calendar-list-event[data-day='2026-09-23']").length > 0;
  }
  const board = document.querySelector(".tasks-board-view [aria-label='Quadro de tarefas']");
  if (!board || board.scrollLeft !== 0) return false;
  const columns = [...board.querySelectorAll(".kanban-column")];
  return columns.length === 3 && ["A fazer", "Em andamento", "Concluídas"].every((title, index) => columns[index].querySelector("h2")?.textContent?.trim() === title)
    && board.querySelectorAll(".kanban-card").length > 0;
}

export function assertGalleryTarget(raw, base, scene) {
  const target = galleryScenes.find(value => value.scene === scene);
  if (!target || raw !== captureOrigin(base) + target.route) refuse("CAPTURE_GALLERY_TARGET");
  return target;
}

export function galleryFiles() {
  return Object.freeze(["light", "dark"].flatMap(theme => galleryScenes.flatMap(({ scene }) =>
    [scene, `${scene}-celular`].map(name => `${name}${theme === "dark" ? "-escuro" : ""}.webp`))));
}

export function galleryMembers() {
  return Object.freeze(galleryFiles().flatMap(file => [file, `${file}.json`]).concat(galleryReceipt));
}

export function galleryExifDescription(scene, theme, mobile, sha) {
  if (!galleryScenes.some(value => value.scene === scene) || !["light", "dark"].includes(theme)
    || typeof mobile !== "boolean" || sha?.length !== 40 || !/^[a-f0-9]{40}$/u.test(sha ?? "")) refuse("CAPTURE_GALLERY_RECORDS");
  return `Segundo Cerebro | real demo capture | ${scene} | ${theme} | ${mobile ? "mobile" : "desktop"} | Source ${sha}`;
}

export function assertGalleryRecords(records) {
  const files = galleryFiles();
  if (!Array.isArray(records) || records.length !== 8 || records.some((record, index) => {
    const scene = galleryScenes[Math.floor(index / 2) % 2];
    return record.file !== files[index] || record.sidecar !== `${files[index]}.json` || record.scene !== scene.scene
      || record.route !== scene.route || record.theme !== (index < 4 ? "light" : "dark")
      || record.sha256?.length !== 64 || record.sidecarSha256?.length !== 64
      || !/^[a-f0-9]{64}$/u.test(record.sha256 ?? "") || !/^[a-f0-9]{64}$/u.test(record.sidecarSha256 ?? "");
  })) refuse("CAPTURE_GALLERY_RECORDS");
}

function refuse(code) { throw new Error(code); }

const policyDiagnostics = new Set([
  "CAPTURE_BASE", "CAPTURE_REQUEST_METHOD", "CAPTURE_REQUEST_URL", "CAPTURE_REQUEST_PATH",
  "CAPTURE_REQUEST_ORIGIN", "CAPTURE_REQUEST_API", "CAPTURE_IMAGE_TARGET", "CAPTURE_REQUEST_POLICY",
]);
const phaseDiagnostics = Object.freeze({
  opening: "CAPTURE_PHASE_OPENING", "initial-document": "CAPTURE_PHASE_INITIAL_DOCUMENT", navigation: "CAPTURE_PHASE_NAVIGATION",
  readiness: "CAPTURE_PHASE_READINESS", pixels: "CAPTURE_PHASE_PIXELS",
  mobile: "CAPTURE_PHASE_MOBILE", closing: "CAPTURE_PHASE_CLOSING",
});
const resourceDiagnostics = Object.freeze({
  document: "CAPTURE_RESOURCE_DOCUMENT", stylesheet: "CAPTURE_RESOURCE_STYLESHEET", image: "CAPTURE_RESOURCE_IMAGE",
  media: "CAPTURE_RESOURCE_MEDIA", font: "CAPTURE_RESOURCE_FONT", script: "CAPTURE_RESOURCE_SCRIPT",
  texttrack: "CAPTURE_RESOURCE_TEXTTRACK", xhr: "CAPTURE_RESOURCE_XHR", fetch: "CAPTURE_RESOURCE_FETCH",
  eventsource: "CAPTURE_RESOURCE_EVENTSOURCE", websocket: "CAPTURE_RESOURCE_WEBSOCKET",
  manifest: "CAPTURE_RESOURCE_MANIFEST", other: "CAPTURE_RESOURCE_OTHER",
});
const faultDiagnostics = Object.freeze({
  requestfailed: "CAPTURE_REQUEST_FAILED", pageerror: "CAPTURE_PAGE_ERROR", crash: "CAPTURE_PAGE_CRASH",
  unexpectedPage: "CAPTURE_POPUP", popupClose: "CAPTURE_POPUP_CLOSE", download: "CAPTURE_DOWNLOAD",
  websocket: "CAPTURE_WEBSOCKET", interrupted: "CAPTURE_INTERRUPTED",
});
const operationDiagnostics = new Set([
  "CAPTURE_SOURCE_CHANGED", "CAPTURE_INTERRUPTED", "CAPTURE_PROJECT_TARGET", "CAPTURE_PROJECT_NOT_READY",
  "CAPTURE_PROJECT_ERROR", "CAPTURE_PAGE_GATE", "CAPTURE_PROJECT_RECORDS", "CAPTURE_OUTPUT_SCOPE",
  "CAPTURE_HEALTH", "CAPTURE_DIAGNOSTIC_STATE", "CAPTURE_REQUEST_REFUSED", "CAPTURE_PROJECT_PREFETCH_POLICY",
  "CAPTURE_GALLERY_TARGET", "CAPTURE_GALLERY_NOT_READY", "CAPTURE_GALLERY_ERROR", "CAPTURE_GALLERY_RECORDS", "CAPTURE_GALLERY_EXIF",
]);
const httpDiagnostics = new Map([
  [401, "CAPTURE_HTTP_UNAUTHORIZED"], [403, "CAPTURE_HTTP_FORBIDDEN"], [404, "CAPTURE_HTTP_NOT_FOUND"],
  [408, "CAPTURE_HTTP_REQUEST_TIMEOUT"], [429, "CAPTURE_HTTP_RATE_LIMIT"], [500, "CAPTURE_HTTP_INTERNAL_ERROR"],
  [502, "CAPTURE_HTTP_BAD_GATEWAY"], [503, "CAPTURE_HTTP_UNAVAILABLE"], [504, "CAPTURE_HTTP_GATEWAY_TIMEOUT"],
]);
const categories = new Set([
  ...policyDiagnostics, ...operationDiagnostics, ...Object.values(faultDiagnostics), ...httpDiagnostics.values(),
  "CAPTURE_HTTP_CLIENT_ERROR", "CAPTURE_HTTP_SERVER_ERROR", "CAPTURE_HTTP_STATUS_INVALID", "CAPTURE_UNKNOWN_FAILURE", "CAPTURE_OPERATION_FAILED",
]);
const phases = new Set([...Object.values(phaseDiagnostics), "CAPTURE_PHASE_UNKNOWN"]);
const resources = new Set(Object.values(resourceDiagnostics));
const closedValue = (dictionary, key, fallback) => typeof key === "string" && Object.hasOwn(dictionary, key) ? dictionary[key] : fallback;

// A first-failure tuple only contains literals from the closed dictionaries above.
// Candidate operation messages require exact equality; never parse or echo them.
export function firstCaptureDiagnostic(previous, observation, phase) {
  if (previous !== null) {
    if (!Array.isArray(previous) || previous.length < 2 || previous.length > 3
      || !categories.has(previous[0]) || !phases.has(previous[1])
      || (previous.length === 3 && (previous[0] !== "CAPTURE_REQUEST_FAILED" || !resources.has(previous[2])))) refuse("CAPTURE_DIAGNOSTIC_STATE");
    return Object.freeze([...previous]);
  }
  let code = closedValue(faultDiagnostics, observation?.kind, "CAPTURE_UNKNOWN_FAILURE");
  if (observation?.kind === "policy") {
    const value = observation.code;
    code = policyDiagnostics.has(value) ? value : "CAPTURE_REQUEST_POLICY";
  }
  if (observation?.kind === "operation") {
    const value = observation.code;
    code = operationDiagnostics.has(value) ? value : "CAPTURE_OPERATION_FAILED";
  }
  if (observation?.kind === "http") {
    const status = observation.status;
    code = !Number.isInteger(status) || status < 400 || status > 599 ? "CAPTURE_HTTP_STATUS_INVALID"
      : httpDiagnostics.get(status) ?? (status < 500 ? "CAPTURE_HTTP_CLIENT_ERROR" : "CAPTURE_HTTP_SERVER_ERROR");
  }
  const codes = [code, closedValue(phaseDiagnostics, phase, "CAPTURE_PHASE_UNKNOWN")];
  if (code === "CAPTURE_REQUEST_FAILED") codes.push(closedValue(resourceDiagnostics, observation.resourceType, "CAPTURE_RESOURCE_OTHER"));
  return Object.freeze(codes);
}

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
    else if (value === "projeto" || value === "galeria") mode = value;
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
  } catch (error) {
    // Never echo a URL, query, body or authorization header to the runner.
    const value = error instanceof Error ? error.message : undefined;
    const code = policyDiagnostics.has(value) ? value : "CAPTURE_REQUEST_POLICY";
    return Object.freeze({ allowed: false, code });
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
  if (mode === "galeria") {
    const file = `${name}${theme === "dark" ? "-escuro" : ""}.webp`;
    if (!galleryScenes.some(({ scene }) => name === scene || name === `${scene}-celular`)
      || !["light", "dark"].includes(theme) || !galleryFiles().includes(file)) refuse("CAPTURE_OUTPUT_SCOPE");
    return file;
  }
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
  if (["requestfailed", "pageerror", "crash", "unexpectedPage", "popupClose"].includes(observation?.kind)) return previous + 1;
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
