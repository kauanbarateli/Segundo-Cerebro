import { types } from "node:util";

/** Passive callback observations only. This is never a browser acceptance report. */
export const AUTH_LOCAL_LIFECYCLE_FILE = "auth-local-playwright-lifecycle.json";
export const AUTH_LOCAL_LIFECYCLE_MAX_BYTES = 4096;
export const AUTH_LOCAL_LIFECYCLE_LIMIT = 64;
export const AUTH_LOCAL_LIFECYCLE_EVENTS = Object.freeze(["begin", "test-begin", "test-end", "error-seen", "end"]);
export const AUTH_LOCAL_LIFECYCLE_END_STATUSES = Object.freeze(["unknown", "passed", "failed", "timedout", "interrupted"]);
const COUNT_KEYS = Object.freeze(["begin", "testBegin", "testEnd", "errorSeen", "end"]);
const COUNT_FOR = Object.freeze({ begin: "begin", "test-begin": "testBegin", "test-end": "testEnd", "error-seen": "errorSeen", end: "end" });
const KEYS = Object.freeze(["schemaVersion", "scenario", "diagnosticOnly", "phase", "counts", "events", "activeTests", "orderViolation", "overflow"]);
const V2_KEYS = Object.freeze([...KEYS, "endStatus"]);
const refused = () => { throw new Error("AUTH_LOCAL_LIFECYCLE_REFUSED"); };
const integer = value => Number.isSafeInteger(value) && value >= 0 && value <= AUTH_LOCAL_LIFECYCLE_LIMIT;

function data(value, keys) {
  if (!value || types.isProxy(value) || Object.getPrototypeOf(value) !== Object.prototype) refused();
  const descriptors = Object.getOwnPropertyDescriptors(value), actual = Reflect.ownKeys(descriptors);
  if (actual.length !== keys.length || actual.some(key => typeof key !== "string" || !keys.includes(key)) ||
    keys.some(key => !Object.hasOwn(descriptors, key) || !descriptors[key].enumerable || !Object.hasOwn(descriptors[key], "value"))) refused();
  return Object.fromEntries(keys.map(key => [key, descriptors[key].value]));
}

/** Closed observations; callers supply event names, never Playwright objects. */
export function createAuthLocalLifecycle() {
  let phase = "initial", activeTests = 0, orderViolation = false, overflow = false, sealed = false, endStatus = "unknown";
  const counts = { begin: 0, testBegin: 0, testEnd: 0, errorSeen: 0, end: 0 }, events = [];
  return Object.freeze({
    record(event, status = "unknown") {
      if (!AUTH_LOCAL_LIFECYCLE_EVENTS.includes(event)) refused();
      if (!AUTH_LOCAL_LIFECYCLE_END_STATUSES.includes(status) || event !== "end" && status !== "unknown") refused();
      if (sealed) return;
      const key = COUNT_FOR[event];
      if (counts[key] === AUTH_LOCAL_LIFECYCLE_LIMIT) overflow = true;
      else counts[key]++;
      if (events.length === AUTH_LOCAL_LIFECYCLE_LIMIT) overflow = true;
      else events.push(event);
      if (event === "begin") {
        if (counts.begin !== 1 || phase !== "initial") orderViolation = true;
        phase = "begun";
      } else if (event === "test-begin") {
        if (counts.begin !== 1 || activeTests !== 0) orderViolation = true;
        if (activeTests === AUTH_LOCAL_LIFECYCLE_LIMIT) overflow = true;
        else activeTests++;
        phase = "testing";
      } else if (event === "test-end") {
        if (counts.begin !== 1 || activeTests === 0) orderViolation = true;
        else activeTests--;
        phase = "testing";
      } else if (event === "end") {
        if (activeTests !== 0) orderViolation = true;
        endStatus = status;
        phase = "ended";
        sealed = true;
      }
    },
    snapshot() {
      return Object.freeze({ schemaVersion: 2, scenario: "auth-local-playwright-lifecycle", diagnosticOnly: true,
        phase, counts: Object.freeze({ ...counts }), events: Object.freeze([...events]), activeTests, orderViolation, overflow, endStatus });
    },
  });
}

/** Reject getters, extra fields and arbitrary text without reflecting input. */
export function validateAuthLocalLifecycle(value) {
  try {
    if (!value || types.isProxy(value)) refused();
    const version = Object.getOwnPropertyDescriptor(value, "schemaVersion");
    if (!version || !Object.hasOwn(version, "value") || ![1, 2].includes(version.value)) refused();
    const row = data(value, version.value === 1 ? KEYS : V2_KEYS), counts = data(row.counts, COUNT_KEYS);
    if (row.scenario !== "auth-local-playwright-lifecycle" || row.diagnosticOnly !== true ||
      !["initial", "begun", "testing", "ended"].includes(row.phase) || !integer(row.activeTests) ||
      row.schemaVersion === 2 && (!AUTH_LOCAL_LIFECYCLE_END_STATUSES.includes(row.endStatus) || row.phase !== "ended" && row.endStatus !== "unknown") ||
      typeof row.orderViolation !== "boolean" || typeof row.overflow !== "boolean" ||
      COUNT_KEYS.some(key => !integer(counts[key])) || types.isProxy(row.events) || !Array.isArray(row.events) || Object.getPrototypeOf(row.events) !== Array.prototype) refused();
    const descriptors = Object.getOwnPropertyDescriptors(row.events), length = descriptors.length?.value;
    if (!integer(length) || Reflect.ownKeys(descriptors).length !== length + 1) refused();
    const events = [];
    for (let index = 0; index < length; index++) {
      const entry = descriptors[String(index)];
      if (!entry?.enumerable || !Object.hasOwn(entry, "value") || !AUTH_LOCAL_LIFECYCLE_EVENTS.includes(entry.value)) refused();
      events.push(entry.value);
    }
    const prefix = createAuthLocalLifecycle();
    for (const event of events) prefix.record(event);
    const observed = prefix.snapshot();
    if (observed.events.length !== events.length) refused();
    if (!row.overflow) {
      if (observed.phase !== row.phase || observed.activeTests !== row.activeTests || observed.orderViolation !== row.orderViolation ||
        COUNT_KEYS.some(key => observed.counts[key] !== counts[key])) refused();
    } else if (events.length !== AUTH_LOCAL_LIFECYCLE_LIMIT || observed.phase === "ended" ||
      COUNT_KEYS.some(key => counts[key] < observed.counts[key]) || observed.orderViolation && !row.orderViolation ||
      counts.end > 1 || (row.phase === "ended") !== (counts.end === 1) || row.activeTests > counts.testBegin ||
      row.phase === "initial" && (counts.begin !== 0 || counts.testBegin !== 0 || counts.testEnd !== 0 || counts.end !== 0 || row.activeTests !== 0) ||
      row.phase === "begun" && counts.begin === 0 || row.phase === "testing" && counts.testBegin + counts.testEnd === 0) refused();
    return Object.freeze({ schemaVersion: row.schemaVersion, scenario: "auth-local-playwright-lifecycle", diagnosticOnly: true, phase: row.phase,
      counts: Object.freeze({ ...counts }), events: Object.freeze(events), activeTests: row.activeTests,
      orderViolation: row.orderViolation, overflow: row.overflow, ...(row.schemaVersion === 2 ? { endStatus: row.endStatus } : {}) });
  } catch { return refused(); }
}
