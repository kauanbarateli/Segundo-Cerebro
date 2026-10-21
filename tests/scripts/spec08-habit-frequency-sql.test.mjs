import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createLocalCanonicalSql } from "../helpers/local-canonical-sql.ts";

// Disposable canonical SQL, synthetic Auth catalogue and finalized metadata.
// No hosted DB/Auth/Storage, object bytes, credentials or commercial acceptance.
test("SPEC08 habit history: canonical transitions, closed state, atomic receipts and image authority", async () => {
  const db = await createLocalCanonicalSql(), owner = { id: randomUUID(), session: randomUUID() }, other = { id: randomUUID(), session: randomUUID() };
  await db.exec("begin");
  try {
    for (const actor of [owner, other]) { await db.query("insert into auth.users(id,aud,role,email) values($1,'authenticated','authenticated',$2)", [actor.id, actor.id + "@example.invalid"]); await db.query("insert into auth.sessions(id,user_id) values($1,$2)", [actor.session, actor.id]); }
    const today = (await db.query("select to_char(clock_timestamp() at time zone 'America/Sao_Paulo','YYYY-MM-DD') as day")).rows[0].day;
    const now = today + "T15:00:00.000Z", beforeDay = new Date(Date.parse(today + "T12:00:00Z") - 86400000).toISOString().slice(0, 10);
    const habitId = randomUUID(), base = { id: habitId, user_id: owner.id, name: "Histórico sintético", schedule_kind: "daily", weekdays: [], weekly_target: null, started_on: beforeDay, archived_at: null, color_key: "personal", icon_key: null, position: 0, created_at: now, updated_at: now };
    const daily = { schedule_kind: "daily", weekdays: [], weekly_target: null }, weekly = { schedule_kind: "weekly_target", weekdays: [], weekly_target: 3 };
    const row = (day, frequency) => ({ version: 1, habit_id: habitId, user_id: owner.id, effective_from: day, ...frequency });
    const history = (changes, baseline_origin = "legacy_known_frequency") => ({ version: 1, baseline_origin, changes });
    await db.query("insert into public.habits(payload) values($1::jsonb)", [JSON.stringify(base)]);
    async function probe(sql, params = [], role = null) {
      assert.ok([null, "service_role", "anon", "authenticated"].includes(role));
      await db.exec("savepoint habit_probe");
      try { if (role) await db.exec("set local role " + role); const result = await db.query(sql, params); await db.exec("reset role; release savepoint habit_probe"); return result.rows[0]?.result; }
      catch (error) { await db.exec("rollback to savepoint habit_probe; release savepoint habit_probe; reset role"); throw error; }
    }
    const service = (actor, name, args = []) => {
      const calls = { snapshot: "select public.projects_habits_snapshot($1,$2,$3) as result", commit: "select public.projects_habits_commit($1,$2,$3,$4::jsonb) as result", set: "select public.file_entity_image_set($1,$2,$3::jsonb) as result", get: "select public.file_entity_image_get($1,$2,$3,$4) as result" };
      assert.ok(Object.hasOwn(calls, name)); return probe(calls[name], [actor.id, actor.session, ...args], "service_role");
    };
    const state = () => service(owner, "snapshot", ["read.habits"]);
    const ledger = async () => (await db.query("select jsonb_build_object('habits',(select jsonb_agg(to_jsonb(h) order by id) from public.habits h),'entries',(select jsonb_agg(to_jsonb(e) order by id) from public.habit_entries e),'events',(select jsonb_agg(to_jsonb(e) order by id) from public.domain_events e),'receipts',(select jsonb_agg(to_jsonb(r) order by user_id,command,client_id) from app_private.command_receipts r),'revision',(select jsonb_agg(to_jsonb(r) order by user_id) from app_private.projects_habits_revisions r),'limiter',(select jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text) from app_private.rate_limits r)) as value")).rows[0].value;
    async function envelope(command, before, after, input, action = "updated") {
      const snapshot = await state(), kind = command === "habit.mark" ? "habit_entry" : "habit";
      return { expectedRevision: snapshot.revision, context: { user_id: owner.id, canal: "web" }, changes: [{ type: kind, before, after }], events: [{ id: randomUUID(), user_id: owner.id, entity_type: kind, entity_id: (after ?? before).id, action, canal: "web", occurred_at: now, before, after }], receipt: { user_id: owner.id, command, client_id: input.client_id, fingerprint: JSON.stringify(input), result: after } };
    }
    const initial = await state(); assert.equal(Object.hasOwn(initial.habits[0], "frequency_history"), false);
    const expected = history([row(beforeDay, daily), row(today, weekly)]);
    assert.deepEqual(await probe("select app_private.habit_frequency_expected($1::jsonb,$2::jsonb,$3::date) as result", [JSON.stringify(base), JSON.stringify({ ...base, ...weekly }), today]), expected);
    for (const invalid of [null, {}, { ...expected, changes: [] }, { ...expected, baseline_origin: "supplied_history" }, { ...expected, extra: true }, { ...expected, changes: [row(beforeDay, daily), { ...row(today, weekly), effective_from: null }] }, { ...expected, changes: [row(beforeDay, daily), { ...row(today, weekly), user_id: other.id }] }]) {
      await assert.rejects(probe("select app_private.habit_frequency_state($1::jsonb) as result", [JSON.stringify({ ...base, ...weekly, frequency_history: invalid })]));
    }
    const changed = { ...base, ...weekly, frequency_history: expected }, changeInput = { id: habitId, patch: weekly, client_id: "frequency-change" };
    const change = await envelope("habit.update", base, changed, changeInput);
    const before = await ledger();
    await assert.rejects(service(owner, "commit", ["habit.update", JSON.stringify({ ...change, receipt: { ...change.receipt, result: { ...changed, name: "Divergent result" } } })]), error => error.code === "23514");
    assert.deepEqual(await ledger(), before, "failure after row/event work must roll back the complete ledger");
    assert.deepEqual(await service(owner, "commit", ["habit.update", JSON.stringify(change)]), { status: "committed", result: changed });
    const withHistory = await ledger();
    await assert.rejects(probe("update public.habits set payload=payload-'frequency_history' where id=$1", [habitId]), error => error.code === "23514");
    assert.deepEqual(await ledger(), withHistory);
    const roundtrip = { ...base, frequency_history: history([row(beforeDay, daily)]) };
    const back = await envelope("habit.update", changed, roundtrip, { id: habitId, patch: daily, client_id: "frequency-return" });
    await service(owner, "commit", ["habit.update", JSON.stringify(back)]);
    assert.deepEqual((await state()).habits[0].frequency_history, roundtrip.frequency_history);
    // Explicit clock contract input, not a fabricated database wall clock.
    await assert.rejects(probe("select app_private.habit_check_attempt_clock($1::jsonb,$2::timestamptz) as result", [JSON.stringify(back), today + "T02:59:59.999Z"]), error => error.code === "40001");
    await probe("select app_private.habit_check_attempt_clock($1::jsonb,$2::timestamptz) as result", [JSON.stringify(back), today + "T03:00:00.000Z"]);
    // A real SQL entry follows the same day rule; old/current cadence cannot
    // approve a retroactive mark on an excluded historical weekday.
    const excluded = (new Date(today + "T12:00:00Z").getUTCDay() + 1) % 7;
    const specific = { schedule_kind: "weekdays", weekdays: [excluded], weekly_target: null };
    const restricted = { ...roundtrip, ...specific, frequency_history: history([row(beforeDay, daily), row(today, specific)]) };
    await service(owner, "commit", ["habit.update", JSON.stringify(await envelope("habit.update", roundtrip, restricted, { id: habitId, patch: specific, client_id: "specific" }))]);
    const entry = { id: randomUUID(), user_id: owner.id, habit_id: habitId, done_on: today, note: null, created_at: now };
    const denied = await envelope("habit.mark", null, entry, { habit_id: habitId, done_on: today, done: true, client_id: "excluded" }, "created");
    const stable = await ledger(); await assert.rejects(service(owner, "commit", ["habit.mark", JSON.stringify(denied)]), error => error.code === "23514"); assert.deepEqual(await ledger(), stable);
    // Create a real entry through the RPC, then preserve it across the change.
    await service(owner, "commit", ["habit.update", JSON.stringify(await envelope("habit.update", restricted, roundtrip, { id: habitId, patch: daily, client_id: "allow-mark" }))]);
    await service(owner, "commit", ["habit.mark", JSON.stringify(await envelope("habit.mark", null, entry, { habit_id: habitId, done_on: today, done: true, client_id: "mark" }, "created"))]);
    await service(owner, "commit", ["habit.update", JSON.stringify(await envelope("habit.update", roundtrip, restricted, { id: habitId, patch: specific, client_id: "exclude-again" }))]);
    await service(owner, "commit", ["habit.mark", JSON.stringify(await envelope("habit.mark", entry, null, { habit_id: habitId, done_on: today, done: false, client_id: "undo" }, "deleted"))]);
    assert.equal((await state()).entries.length, 0);
    const archived = { ...restricted, archived_at: now };
    await service(owner, "commit", ["habit.archive", JSON.stringify(await envelope("habit.archive", restricted, archived, { id: habitId, client_id: "archive" }, "deleted"))]);
    assert.deepEqual(await service(owner, "commit", ["habit.update", JSON.stringify(change)]), { status: "replayed", result: changed });
    assert.equal((await state()).habits[0].archived_at, now);
    const newId = randomUUID(), newHabit = { ...base, id: newId, image_file_id: null, frequency_history: history([{ ...row(beforeDay, daily), habit_id: newId }], "created_frequency") };
    const createInput = { name: newHabit.name, ...daily, started_on: beforeDay, color_key: newHabit.color_key, icon_key: null, position: 0, client_id: "new-canonical-habit" };
    const creation = await envelope("habit.create", null, newHabit, createInput, "created");
    assert.deepEqual(await service(owner, "commit", ["habit.create", JSON.stringify(creation)]), { status: "committed", result: newHabit });
    assert.deepEqual(await service(owner, "commit", ["habit.create", JSON.stringify(creation)]), { status: "replayed", result: newHabit });
    const { frequency_history: omitted, ...oldWriterCreate } = { ...newHabit, id: randomUUID() };
    assert.ok(omitted);
    const invalidCreation = await envelope("habit.create", null, oldWriterCreate, { ...createInput, client_id: "old-writer-create" }, "created");
    const beforeOldWriter = await ledger();
    await assert.rejects(service(owner, "commit", ["habit.create", JSON.stringify(invalidCreation)]), error => error.code === "23514");
    assert.deepEqual(await ledger(), beforeOldWriter);
    await db.query("insert into public.user_entitlements(user_id,feature_key,allowed) values($1,'habitos',false)", [owner.id]);
    await assert.rejects(service(owner, "commit", ["habit.update", JSON.stringify(change)]), error => error.code === "42501");
    await assert.rejects(service(owner, "get", ["habit_image", habitId]), error => error.code === "42501");
    await assert.rejects(service(other, "get", ["habit_image", habitId]), error => error.code === "42501");
    for (const role of ["anon", "authenticated"]) {
      await assert.rejects(probe("select public.projects_habits_snapshot($1,$2,'read.habits') as result", [owner.id, owner.session], role), error => error.code === "42501");
      await assert.rejects(probe("select app_private.habit_frequency_state($1::jsonb) as result", [JSON.stringify(base)], role), error => error.code === "42501");
      await assert.rejects(probe("update public.habits set payload=payload where id=$1", [habitId], role), error => error.code === "42501");
    }
    assert.equal((await db.query("select current_setting('app.spec08_habit_attempt_day',true) as value")).rows[0].value ?? "", "", "internal clock context must be restored");
  } finally { await db.exec("rollback"); await db.close(); }
});
