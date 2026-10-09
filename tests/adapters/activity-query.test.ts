import { expect, it } from "vitest";
import { activityQuery } from "../../src/adapters/db/activity-query";
const id = "10000000-0000-4000-8000-000000000001";
it.each(["limit=0", "limit=51", "limit=1.5", "limit=1&limit=2", "before_id=" + id, "before_time=2026-10-07T20:00:00Z", "user_id=" + id, "before_time=2026-02-31T20:00:00Z&before_id=" + id])("rejects invalid activity HTTP query %s", query => {
  expect(() => activityQuery(new URLSearchParams(query))).toThrow();
});
