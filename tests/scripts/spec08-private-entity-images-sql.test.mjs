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
    for (const purpose of ["project_cover", "home_focus_image", "habit_image", "finance_goal_image"]) {
      const id = randomUUID(), lease = randomUUID();
      await service(owner, "select public.file_upload_reserve($1,$2,$3,'synthetic.png',null,$4,$5,8388608,1073741824,$6::timestamptz) as result", [purpose, "reserve-" + purpose, id, expires]);
      await service(owner, "select public.file_upload_claim($1,$2,$3,$4,$5) as result", [id, lease, "finalize-" + purpose]);
      const file = { id, user_id: owner.id, kind: purpose, folder_id: null, name: "synthetic.png", mime: "image/png", bytes: 100, sha256: "a".repeat(64), width: 40, height: 20, starred: false, deleted_at: null, deletion_batch_id: null, created_at: new Date(Date.now() - 2 * 86_400_000).toISOString(), updated_at: now, modified_at: now };
      await service(owner, "select public.file_upload_complete($1,$2,$3,$4,$5,$6::jsonb,1073741824) as result", [id, lease, "finalize-" + purpose, JSON.stringify(file)]);
      files[purpose] = id;
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
    // Unlinked old images become orphans; project/home references stay protected.
    await db.query("update app_private.upload_reservations set expires_at=now()-interval '2 days',cleaned_at=now()-interval '2 days' where user_id=$1", [owner.id]);
    const cleanup = (await db.query("select app_private.file_cleanup_candidates() as result")).rows[0].result;
    assert.equal(cleanup.some(row => row.id === files.project_cover && row.remove_final), false);
    assert.equal(cleanup.some(row => row.id === files.home_focus_image && row.remove_final), false);
    assert.equal(cleanup.some(row => row.id === files.habit_image && row.remove_final), true);
    // A purge candidate cannot be linked late, after deletion was committed.
    await assert.rejects(set(owner, { ...request, file_id: files.habit_image, expected_file_id: files.project_cover, client_id: "late-link" }));
    await db.query("insert into public.user_entitlements(user_id,feature_key,allowed) values($1,'projetos',false)", [owner.id]);
    await assert.rejects(set(owner, request), error => error.code === "42501");
    await assert.rejects(service(owner, "select public.file_read_metadata($1,$2,$3) as result", [files.project_cover]), error => error.code === "42501");
  } finally { await db.exec("rollback"); await db.close(); }
});
