/** Finite SQL text/tickets only. No psql, SQL, Auth, browser or Storage calls. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { GOAL_IMAGES_NATIVE_ACTIONS, goalImagesNativeStatement, goalNativeStatement, inspectGoalNativeStatement, frameGoalNativeStatement } from "../e2e-auth-local/finance-goals-terminal-native-sql.mjs";
const id = n => `79f10000-0000-4000-8000-${n.toString().padStart(12, "0")}`;
const context = { namespace: "sc-goals-terminal-native-" + "a".repeat(32), sourceSha: "b".repeat(40), systemIdentifier: "7250000000000000001" };
const actor = () => ({ owner: id(1), session: id(2), uploadId: id(3), clientId: id(4) });
const reserve = () => ({ ...actor(), kind: "finance_goal_image", expires: "2026-10-25T12:00:00.000Z" });
const complete = () => ({ ...actor(), leaseId: id(5), kind: "finance_goal_image", createdAt: "2026-10-23T12:00:00.000Z", updatedAt: "2026-10-24T12:00:00.000Z" });
const inspect = (action, data) => inspectGoalNativeStatement(goalImagesNativeStatement(context, action, data), context);
test("the whole original N SQL module remains a literal byte prefix", async () => {
  const bytes = await readFile(new URL("../e2e-auth-local/finance-goals-terminal-native-sql.mjs", import.meta.url));
  assert.equal(createHash("sha256").update(bytes.subarray(0, 12140)).digest("hex"), "8a2a77b6b486dc34a75afce5da255c9b89f846dc06929b33c68cff487674eefa");
  assert.equal(inspectGoalNativeStatement(goalNativeStatement(context, "BEGIN", { role: "service_role" }), context).transition, "open");
});
test("the seven image actions use only existing ACK kinds and the same nominal registry", () => {
  assert.equal(GOAL_IMAGES_NATIVE_ACTIONS.length, 7);
  const cases = [["IMAGE_RESERVE", reserve(), "file_upload_reserve"], ["IMAGE_CLAIM", { ...actor(), leaseId: id(5) }, "file_upload_claim"], ["IMAGE_COMPLETE", complete(), "file_upload_complete"], ["IMAGE_CLEANUP_CANDIDATES", {}, "file_cleanup_candidates"], ["IMAGE_CLEANUP_ACK", { uploadId: id(3) }, "file_cleanup_ack"]];
  for (const [action, data, rpc] of cases) { const value = inspect(action, data); assert.equal(value.expected, "rpc"); assert.equal(value.expectation.rpc, rpc); assert.equal(value.writing, true); assert.equal(value.transition, null); assert.match(value.sql, new RegExp("public\\." + rpc + "\\(")); }
  for (const [action, expected] of [["IMAGE_MATERIAL", "material"], ["IMAGE_ABSENCE", "absence"]]) { const value = inspect(action, { a: id(1), b: id(2) }); assert.equal(value.expected, expected); assert.equal(value.writing, false); }
});
test("a public ticket shape, clone and foreign context never authorize SQL", () => {
  const ticket = goalImagesNativeStatement(context, "IMAGE_RESERVE", reserve());
  const framed = frameGoalNativeStatement(ticket, context, "c".repeat(32), 1); assert.match(framed.input, /^select 'SC_GOALS_NATIVE:/);
  for (const fake of [{ ...ticket }, structuredClone(ticket)]) assert.throws(() => inspectGoalNativeStatement(fake, context));
  assert.throws(() => inspectGoalNativeStatement(ticket, { ...context, sourceSha: "d".repeat(40) }));
});
test("the finalized fixture is bound, fixed metadata and a captured immutable SQL value, not an observation", () => {
  const data = complete(), ticket = goalImagesNativeStatement(context, "IMAGE_COMPLETE", data), before = inspectGoalNativeStatement(ticket, context).sql;
  data.owner = id(90); data.updatedAt = "2027-01-01T00:00:00.000Z";
  assert.equal(inspectGoalNativeStatement(ticket, context).sql, before);
  const match = before.match(/decode\('([a-f0-9]+)','hex'\)/); assert.ok(match);
  const value = JSON.parse(Buffer.from(match[1], "hex").toString("utf8"));
  assert.equal(value.id, id(3)); assert.equal(value.user_id, id(1)); assert.equal(value.kind, "finance_goal_image"); assert.equal(value.name, "synthetic.png");
  assert.equal(value.bytes, 100); assert.equal(value.width, 40); assert.equal(value.height, 20); assert.equal(value.sha256, "a".repeat(64));
  assert.equal(value.created_at, "2026-10-23T12:00:00.000Z"); assert.equal(value.updated_at, "2026-10-24T12:00:00.000Z");
});
test("caller-selected RPC, SQL, quota, file body, path and unsupported purpose are refused", () => {
  for (const data of [{ ...reserve(), rpc: "pg_sleep" }, { ...reserve(), sql: "select 1" }, { ...reserve(), quota: 999 }, { ...reserve(), name: "other.png" }, { ...reserve(), kind: "foreign_purpose" }]) assert.throws(() => inspect("IMAGE_RESERVE", data));
  assert.throws(() => inspect("IMAGE_COMPLETE", { ...complete(), file: { body: "SYNTHETIC" } }));
  for (const action of ["RPC", "IMAGE_FIXTURE", "select 1", "IMAGE_CLEANUP_LOG", "IMAGE_CLEAR"]) assert.throws(() => inspect(action, {}));
  for (const data of [{ uploadId: id(3), owner: id(1) }, { uploadId: id(3), path: "owner/file" }]) assert.throws(() => inspect("IMAGE_CLEANUP_ACK", data));
});
test("invalid UUIDs, dates, duplicate owners and reversed metadata chronology refuse before issuance", () => {
  for (const data of [{ ...reserve(), owner: id(1).toUpperCase() }, { ...reserve(), clientId: "free-client" }, { ...reserve(), expires: "2026-02-30T00:00:00.000Z" }, { ...reserve(), expires: "2026-10-25T12:00:00Z" }]) assert.throws(() => inspect("IMAGE_RESERVE", data));
  assert.throws(() => inspect("IMAGE_COMPLETE", { ...complete(), createdAt: "2027-01-01T00:00:00.000Z" }));
  assert.throws(() => inspect("IMAGE_MATERIAL", { a: id(1), b: id(1) }));
});
test("getter, Proxy and string coercion never run for image tickets or context", () => {
  let hooks = 0; const value = reserve(); Object.defineProperty(value, "owner", { enumerable: true, get() { hooks++; return id(1); } });
  assert.throws(() => inspect("IMAGE_RESERVE", value));
  const coercion = { toString() { hooks++; return id(1); }, [Symbol.toPrimitive]() { hooks++; return id(1); } };
  assert.throws(() => inspect("IMAGE_RESERVE", { ...reserve(), owner: coercion }));
  assert.throws(() => goalImagesNativeStatement({ ...context, namespace: coercion }, "IMAGE_RESERVE", reserve()));
  assert.throws(() => inspect("IMAGE_RESERVE", new Proxy({}, { ownKeys() { hooks++; return []; } })));
  assert.equal(hooks, 0);
});
