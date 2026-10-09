import { describe, expect, it } from "vitest";
import { ACTIVITY_FIELDS, activityTime, compareActivityPosition, validActivityItem, validActivityPage, type ActivityItem } from "../../src/core/activity";
const id = "10000000-0000-4000-8000-000000000001";
const row: ActivityItem = { id, occurred_at: "2026-10-07T20:00:00.000002Z", entity_type: "capture", entity_id: id, action: "updated", canal: "web", title: "Nota", changed_fields: ["content"] };
describe("Activity projection and cursor", () => {
  it.each(Object.keys(ACTIVITY_FIELDS) as (keyof typeof ACTIVITY_FIELDS)[])("permite somente nomes de campos de %s, nunca valores ou cifra", entity_type => {
    const item = { ...row, entity_type, title: entity_type.startsWith("finance_") || entity_type === "vault_metadata" ? null : "Registro", changed_fields: [...ACTIVITY_FIELDS[entity_type]] };
    expect(validActivityItem(item)).toBe(true);
    expect(validActivityItem({ ...item, changed_fields: [...item.changed_fields, "ciphertext"] })).toBe(false);
    expect(validActivityItem({ ...item, after: { password: "private" } })).toBe(false);
    if (entity_type.startsWith("finance_") || entity_type === "vault_metadata") expect(validActivityItem({ ...item, title: "private" })).toBe(false);
  });
  it("rejects timestamps outside the database cursor range, including offsets crossing its boundaries", () => {
    for (const value of ["0000-12-31T23:59:59Z", "0001-01-01T00:00:00+01:00", "9999-12-31T23:59:59.999999-01:00"]) expect(activityTime(value)).toBe(false);
    for (const value of ["0001-01-01T00:00:00.000001Z", "0001-01-01T01:00:00+01:00", "9999-12-31T23:59:59.999999Z"]) expect(activityTime(value)).toBe(true);
  });
  it("preserves microseconds and orders equal instants by UUID", () => {
    const cursor = { id, occurred_at: row.occurred_at };
    expect(cursor.occurred_at).toBe(row.occurred_at);
    expect(compareActivityPosition(cursor, { ...cursor, occurred_at: "2026-10-07T20:00:00.000001Z" })).toBe(1);
    expect(compareActivityPosition(cursor, { ...cursor, occurred_at: "2026-10-07T17:00:00.000002-03:00" })).toBe(0);
    expect(compareActivityPosition(cursor, { ...cursor, id: "10000000-0000-4000-8000-000000000002" })).toBe(-1);
  });
  it("accepts existing 200-character titles without truncation, rejects 201", () => {
    for (const entity_type of ["capture", "task"] as const) {
      expect(validActivityItem({ ...row, entity_type, changed_fields: [], title: "a".repeat(200) })).toBe(true);
      expect(validActivityItem({ ...row, entity_type, changed_fields: [], title: "a".repeat(201) })).toBe(false);
    }
  });
  it("rejects leaked payload, unknown fields and inconsistent next cursors", () => {
    expect(validActivityItem({ ...row, before: { content: "secret" } })).toBe(false);
    expect(validActivityItem({ ...row, changed_fields: ["user_id"] })).toBe(false);
    expect(validActivityItem({ ...row, changed_fields: ["content", "content"] })).toBe(false);
    expect(validActivityPage({ items: [row], next_cursor: { id, occurred_at: row.occurred_at } }, { limit: 2, cursor: null })).toBe(false);
    expect(validActivityPage({ items: [row], next_cursor: { id, occurred_at: row.occurred_at } }, { limit: 1, cursor: null })).toBe(true);
  });
  it("rejects duplicate/reversed records and records at or after the supplied cursor", () => {
    expect(validActivityPage({ items: [row, row], next_cursor: null }, { limit: 20, cursor: null })).toBe(false);
    expect(validActivityPage({ items: [row], next_cursor: null }, { limit: 20, cursor: { id, occurred_at: row.occurred_at } })).toBe(false);
    const earlier = { ...row, id: "10000000-0000-4000-8000-000000000002", occurred_at: "2026-10-07T20:00:00.000001Z" };
    expect(validActivityPage({ items: [earlier, row], next_cursor: null }, { limit: 20, cursor: null })).toBe(false);
    expect(validActivityPage({ items: [earlier], next_cursor: null }, { limit: 20, cursor: { id, occurred_at: row.occurred_at } })).toBe(true);
  });
});
