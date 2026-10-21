import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createLocalCanonicalSql } from "../helpers/local-canonical-sql.ts";

// Disposable SQL catalogue and synthetic final metadata. No remote database,
// Auth HTTP, Storage bytes, signed capability or connected commercial proof.
test("SPEC08 images: owner/purpose/finalization, CAS/replay, old snapshots and cleanup", async () => {
  const db = await createLocalCanonicalSql(), owner = { id: randomUUID(), session: randomUUID() }, other = { id: randomUUID(), session: randomUUID() };
  await db.exec("begin");
  try {
    for (const actor of [owner, other]) {
      await db.query("insert into auth.users(id,aud,role,email) values($1,'authenticated','authenticated',$2)", [actor.id, actor.id + "@example.invalid"]);
      await db.query("insert into auth.sessions(id,user_id) values($1,$2)", [actor.session, actor.id]);
    }
    async function service(actor, sql, params = []) {
      await db.exec("savepoint image_probe");
      try { await db.exec("set local role service_role"); const result = await db.query(sql, [actor.id, actor.session, ...params]); await db.exec("reset role; release savepoint image_probe"); return result.rows[0]?.result; }
      catch (error) { await db.exec("rollback to savepoint image_probe; release savepoint image_probe; reset role"); throw error; }
    }
    const projectId = randomUUID(), now = new Date().toISOString();
    const project = { id: projectId, user_id: owner.id, name: "Projeto sintético", description: null, color_key: "work", position: 0, deleted_at: null, created_at: now, updated_at: now };
    await db.query("insert into public.projects(payload) values($1::jsonb)", [JSON.stringify(project)]);
    const snapshotBefore = await service(owner, "select public.projects_habits_snapshot($1,$2,'read.projects') as result");
    const expires = new Date(Date.now() + 120 * 60_000).toISOString();
    const files = {};
    for (const [key, purpose] of [["project_cover", "project_cover"], ["home_focus_image", "home_focus_image"], ["habit_image", "habit_image"], ["finance_goal_image", "finance_goal_image"], ["orphan_project_cover", "project_cover"]]) {
      const id = randomUUID(), lease = randomUUID();
      await service(owner, "select public.file_upload_reserve($1,$2,$3,'synthetic.png',null,$4,$5,8388608,1073741824,$6::timestamptz) as result", [purpose, "reserve-" + key, id, expires]);
      await service(owner, "select public.file_upload_claim($1,$2,$3,$4,$5) as result", [id, lease, "finalize-" + key]);
      const file = { id, user_id: owner.id, kind: purpose, folder_id: null, name: "synthetic.png", mime: "image/png", bytes: 100, sha256: "a".repeat(64), width: 40, height: 20, starred: false, deleted_at: null, deletion_batch_id: null, created_at: new Date(Date.now() - 2 * 86_400_000).toISOString(), updated_at: now, modified_at: now };
      await service(owner, "select public.file_upload_complete($1,$2,$3,$4,$5,$6::jsonb,1073741824) as result", [id, lease, "finalize-" + key, JSON.stringify(file)]);
      files[key] = id;
    }
    const request = { version: 1, purpose: "project_cover", entity_id: projectId, file_id: files.project_cover, expected_file_id: null, client_id: "bind-project" };
    const set = (actor, input) => service(actor, "select public.file_entity_image_set($1,$2,$3::jsonb) as result", [JSON.stringify(input)]);
    for (const input of [{ ...request, file_id: files.home_focus_image }, { ...request, file_id: randomUUID() }, { ...request, purpose: "avatar" }, { ...request, version: 2 }, { ...request, feature: "configuracoes" }]) await assert.rejects(set(owner, input));
    await assert.rejects(set(other, request), error => ["42501", "23514"].includes(error.code));
    const baseline = (await db.query("select count(*)::int events from public.domain_events where user_id=$1", [owner.id])).rows[0].events;
    const linked = await set(owner, request);
    assert.deepEqual(linked, { version: 1, user_id: owner.id, id: projectId, purpose: "project_cover", file_id: files.project_cover });
    assert.deepEqual(await set(owner, request), linked);
    assert.equal((await db.query("select count(*)::int events from public.domain_events where user_id=$1", [owner.id])).rows[0].events, baseline + 1);
    await assert.rejects(set(owner, { ...request, file_id: null }), error => error.code === "23505");
    await assert.rejects(set(owner, { ...request, file_id: null, client_id: "stale-cas" }), error => error.code === "40001");
    assert.equal((await db.query("select cover_file_id from public.projects where id=$1", [projectId])).rows[0].cover_file_id, files.project_cover);
    const home = { ...request, purpose: "home_focus_image", entity_id: owner.id, file_id: files.home_focus_image, client_id: "bind-home" };
    await set(owner, home);
    await assert.rejects(set(owner, { ...home, entity_id: other.id, client_id: "foreign-home" }), error => error.code === "42501");
    // Old edit prepared before the image must re-read its CAS snapshot.
    const after = { ...project, name: "Nome novo", updated_at: new Date().toISOString() };
    const input = { id: projectId, patch: { name: after.name }, client_id: "old-edit" };
    const stale = { expectedRevision: snapshotBefore.revision, context: { user_id: owner.id, canal: "web" }, changes: [{ type: "project", before: project, after }],
      events: [{ id: randomUUID(), user_id: owner.id, entity_type: "project", entity_id: projectId, action: "updated", canal: "web", occurred_at: now, before: project, after }],
      receipt: { user_id: owner.id, command: "project.update", client_id: input.client_id, fingerprint: JSON.stringify(input), result: after } };
    assert.deepEqual(await service(owner, "select public.projects_habits_commit($1,$2,'project.update',$3::jsonb) as result", [JSON.stringify(stale)]), { status: "stale" });
    const fresh = await service(owner, "select public.projects_habits_snapshot($1,$2,'read.projects') as result");
    assert.equal(fresh.projects[0].cover_file_id, files.project_cover);
    // Habit image has its own authority. Drive/Settings/Projects vetoes do not
    // remove Habits access; its aggregate, receipt, event and CAS stay atomic.
    const habitId = randomUUID(), today = (await db.query("select to_char(clock_timestamp() at time zone 'America/Sao_Paulo','YYYY-MM-DD') as day")).rows[0].day;
    const habit = { id: habitId, user_id: owner.id, name: "Hábito com imagem", schedule_kind: "daily", weekdays: [], weekly_target: null, started_on: today, color_key: "personal", icon_key: null, position: 0, archived_at: null, created_at: now, updated_at: now };
    await db.query("insert into public.habits(payload) values($1::jsonb)", [JSON.stringify(habit)]);
    const habitRequest = { ...request, purpose: "habit_image", entity_id: habitId, file_id: files.habit_image, client_id: "bind-habit" };
    for (const feature of ["drive", "configuracoes", "projetos"]) await db.query("insert into public.user_entitlements(user_id,feature_key,allowed) values($1,$2,false)", [owner.id, feature]);
    const habitEvents = (await db.query("select count(*)::int n from public.domain_events where user_id=$1 and entity_id=$2", [owner.id, habitId])).rows[0].n;
    const habitLinked = await set(owner, habitRequest);
    assert.deepEqual(habitLinked, { version: 1, user_id: owner.id, id: habitId, purpose: "habit_image", file_id: files.habit_image });
    assert.deepEqual(await set(owner, habitRequest), habitLinked);
    assert.equal((await db.query("select count(*)::int n from public.domain_events where user_id=$1 and entity_id=$2", [owner.id, habitId])).rows[0].n, habitEvents + 1);
    assert.equal((await db.query("select image_file_id from public.habits where id=$1", [habitId])).rows[0].image_file_id, files.habit_image);
    await assert.rejects(set(other, habitRequest), error => error.code === "23514");
    await assert.rejects(set(other, { ...habitRequest, file_id: null }), error => error.code === "42501");
    await assert.rejects(set(owner, { ...habitRequest, client_id: "habit-wrong-kind", file_id: files.project_cover }), error => error.code === "23514");
    await assert.rejects(set(owner, { ...habitRequest, client_id: "habit-stale-image", file_id: null }), error => error.code === "40001");
    assert.equal((await set(owner, { ...habitRequest, file_id: null, expected_file_id: files.habit_image, client_id: "unlink-habit" })).file_id, null);
    await set(owner, { ...habitRequest, client_id: "relink-habit" });
    await db.query("update public.habits set payload=payload||jsonb_build_object('archived_at',$2::text) where id=$1", [habitId, now]);
    assert.deepEqual(await service(owner, "select public.file_entity_image_get($1,$2,'habit_image',$3) as result", [habitId]), habitLinked);
    assert.deepEqual(await set(owner, habitRequest), habitLinked, "authorized receipt replay precedes the archived-state guard");
    await assert.rejects(set(owner, { ...habitRequest, expected_file_id: files.habit_image, file_id: null, client_id: "archived-new-image" }), error => error.code === "42501");
    await db.query("delete from public.user_entitlements where user_id=$1 and feature_key=any($2::text[])", [owner.id, ["drive", "configuracoes", "projetos"]]);
    // Prove that the second cover is finalized and eligible with the SAME owner
    // and purpose before orphaning it. A habit_image mismatch cannot test purge.
    const orphanProject = randomUUID();
    await db.query("insert into public.projects(payload) values($1::jsonb)", [JSON.stringify({ ...project, id: orphanProject })]);
    const eligible = { ...request, entity_id: orphanProject, file_id: files.orphan_project_cover, client_id: "eligible-cover" };
    assert.equal((await set(owner, eligible)).file_id, files.orphan_project_cover);
    assert.equal((await set(owner, { ...eligible, file_id: null, expected_file_id: files.orphan_project_cover, client_id: "unlink-orphan" })).file_id, null);
    // Unlinked old images become orphans; project/home references stay protected.
    await db.query("update app_private.upload_reservations set expires_at=now()-interval '2 days',cleaned_at=now()-interval '2 days' where user_id=$1", [owner.id]);
    const cleanup = (await db.query("select app_private.file_cleanup_candidates() as result")).rows[0].result;
    assert.equal(cleanup.some(row => row.id === files.project_cover && row.remove_final), false);
    assert.equal(cleanup.some(row => row.id === files.home_focus_image && row.remove_final), false);
    assert.equal(cleanup.some(row => row.id === files.habit_image && row.remove_final), false, "archived habit retains the real private image reference");
    assert.equal(cleanup.some(row => row.id === files.orphan_project_cover && row.remove_final), true);
    assert.notEqual((await db.query("select deleted_at from public.drive_files where user_id=$1 and id=$2", [owner.id, files.orphan_project_cover])).rows[0].deleted_at, null);
    // The tombstone must refuse a new binding BEFORE any physical-purge ACK.
    const beforeTombstone = (await db.query("select count(*)::int events from public.domain_events where user_id=$1", [owner.id])).rows[0].events;
    assert.equal((await db.query("select purged_at from public.drive_files where user_id=$1 and id=$2", [owner.id, files.orphan_project_cover])).rows[0].purged_at, null);
    await assert.rejects(set(owner, { ...request, file_id: files.orphan_project_cover, expected_file_id: files.project_cover, client_id: "late-tombstone" }), error => error.code === "23514");
    assert.equal((await db.query("select cover_file_id from public.projects where user_id=$1 and id=$2", [owner.id, projectId])).rows[0].cover_file_id, files.project_cover);
    assert.equal((await db.query("select count(*)::int events from public.domain_events where user_id=$1", [owner.id])).rows[0].events, beforeTombstone);
    assert.equal((await db.query("select count(*)::int receipts from app_private.command_receipts where user_id=$1 and command='file.entity-image.set' and client_id='late-tombstone'", [owner.id])).rows[0].receipts, 0);
    // Synthetic SQL ACK only: no claim that Storage bytes were removed here.
    await db.query("select public.file_cleanup_ack($1)", [files.orphan_project_cover]);
    const purged = (await db.query("select kind,purged_at from public.drive_files where user_id=$1 and id=$2", [owner.id, files.orphan_project_cover])).rows[0];
    assert.equal(purged.kind, "project_cover"); assert.notEqual(purged.purged_at, null);
    // A purge candidate cannot be linked late, after deletion was committed.
    const beforeLate = (await db.query("select count(*)::int events from public.domain_events where user_id=$1", [owner.id])).rows[0].events;
    await assert.rejects(set(owner, { ...request, file_id: files.orphan_project_cover, expected_file_id: files.project_cover, client_id: "late-link" }), error => error.code === "23514");
    assert.equal((await db.query("select cover_file_id from public.projects where user_id=$1 and id=$2", [owner.id, projectId])).rows[0].cover_file_id, files.project_cover);
    assert.equal((await db.query("select count(*)::int events from public.domain_events where user_id=$1", [owner.id])).rows[0].events, beforeLate);
    assert.equal((await db.query("select count(*)::int receipts from app_private.command_receipts where user_id=$1 and command='file.entity-image.set' and client_id='late-link'", [owner.id])).rows[0].receipts, 0);
    await db.query("insert into public.user_entitlements(user_id,feature_key,allowed) values($1,'habitos',false)", [owner.id]);
    await assert.rejects(set(owner, habitRequest), error => error.code === "42501");
    await assert.rejects(service(owner, "select public.file_entity_image_get($1,$2,'habit_image',$3) as result", [habitId]), error => error.code === "42501");
    await assert.rejects(service(owner, "select public.file_read_metadata($1,$2,$3) as result", [files.habit_image]), error => error.code === "42501");
    await db.query("insert into public.user_entitlements(user_id,feature_key,allowed) values($1,'projetos',false)", [owner.id]);
    await assert.rejects(set(owner, request), error => error.code === "42501");
    await assert.rejects(service(owner, "select public.file_read_metadata($1,$2,$3) as result", [files.project_cover]), error => error.code === "42501");
  } finally { await db.exec("rollback"); await db.close(); }
});
