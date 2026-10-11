import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { createLocalCanonicalSql } from "../helpers/local-canonical-sql.ts";
import { loadCaptureImageProcessor } from "../e2e-auth-local/capture-image-storage-support.mjs";

// PG18/PGlite with the canonical local Auth/Storage catalog fixture. Processor
// bytes are real; HTTP, signed capabilities, object storage and native PG17 are
// not exercised. Every fixture mutation rolls back before closing the database.
test("avatar: measured original bytes bind to the profile, unlink without purging, and retain exact ledger deltas", async () => {
  const { processor } = await loadCaptureImageProcessor();
  const db = await createLocalCanonicalSql();
  const a = { id: randomUUID(), session: randomUUID() }, b = { id: randomUUID(), session: randomUUID() };
  const upload = randomUUID(), lease = randomUUID();
  let input, prepared;
  const residueSql = `select
    (select count(*)::int from auth.users) as users,
    (select count(*)::int from auth.sessions) as sessions,
    (select count(*)::int from public.profiles) as profiles,
    (select count(*)::int from public.drive_files) as files,
    (select count(*)::int from app_private.upload_reservations) as reservations,
    (select count(*)::int from app_private.command_receipts) as receipts,
    (select count(*)::int from public.domain_events) as events`;
  const baselineResidues = (await db.query(residueSql)).rows;
  try {
    const version = Number((await db.query("select current_setting('server_version_num') as version")).rows[0].version);
    assert.ok(version >= 180000 && version < 190000);
    input = await processor.sharp({ create: { width: 96, height: 96, channels: 3, background: "#345678" } }).png().toBuffer();
    prepared = await processor.prepararArquivo("avatar", "profile.png", input, processor.readFilePolicy({}));
    const decoded = await processor.sharp(prepared.bytes).metadata();
    assert.equal(prepared.mime, "image/jpeg");
    assert.equal(prepared.bytes.byteLength, decoded.size);
    assert.equal(prepared.sha256, createHash("sha256").update(prepared.bytes).digest("hex"));

    await db.exec("begin");
    try {
      for (const owner of [a, b]) {
        await db.query("insert into auth.users(id,aud,role,email) values($1,'authenticated','authenticated',$2)", [owner.id, owner.id + "@example.invalid"]);
        await db.query("insert into auth.sessions(id,user_id) values($1,$2)", [owner.session, owner.id]);
      }
      const inRole = async (role, work) => {
        assert.ok(["service_role", "authenticated"].includes(role));
        await db.exec("savepoint avatar_probe");
        try {
          await db.exec("set local role " + role);
          const result = await work();
          await db.exec("reset role; release savepoint avatar_probe");
          return result;
        } catch (error) {
          await db.exec("rollback to savepoint avatar_probe; release savepoint avatar_probe; reset role");
          throw error;
        }
      };
      const service = (sql, parameters) => inRole("service_role", () => db.query(sql, parameters));
      const profile = owner => db.query("select avatar_file_id,avatar_url from public.profiles where user_id=$1", [owner.id]);
      const ledger = owner => db.query(`select
        (select count(*)::int from public.domain_events where user_id=$1) as events,
        (select count(*)::int from app_private.command_receipts where user_id=$1) as receipts`, [owner.id]);
      const initialA = (await profile(a)).rows, initialB = (await profile(b)).rows;
      assert.deepEqual(initialA, [{ avatar_file_id: null, avatar_url: null }]);
      assert.deepEqual(initialB, initialA);
      const ledgerA = (await ledger(a)).rows[0], ledgerB = (await ledger(b)).rows[0];
      const expires = new Date(Date.now() + 120 * 60_000).toISOString();
      const policy = processor.readFilePolicy({});
      const reserved = await service("select public.file_upload_reserve($1::uuid,$2::uuid,'avatar','profile.png',null,'avatar-reserve',$3::uuid,$4::bigint,$5::bigint,$6::timestamptz) as result", [b.id, b.session, upload, policy.image_max_bytes, policy.quota_bytes, expires]);
      assert.equal(reserved.rows[0].result.staging_path, b.id + "/" + upload);
      assert.equal(reserved.rows[0].result.kind, "avatar");
      await service("select public.file_upload_claim($1::uuid,$2::uuid,$3::uuid,$4::uuid,'avatar-finalize')", [b.id, b.session, upload, lease]);
      const now = new Date().toISOString();
      const file = { id: upload, user_id: b.id, kind: "avatar", folder_id: null, name: prepared.name, mime: prepared.mime, bytes: prepared.bytes.byteLength, sha256: prepared.sha256, width: prepared.width, height: prepared.height, starred: false, deleted_at: null, deletion_batch_id: null, created_at: now, updated_at: now, modified_at: now };
      const finalized = await service("select public.file_upload_complete($1::uuid,$2::uuid,$3::uuid,$4::uuid,'avatar-finalize',$5::jsonb,$6::bigint) as result", [b.id, b.session, upload, lease, JSON.stringify(file), policy.quota_bytes]);
      assert.deepEqual(finalized.rows[0].result, file);
      const stored = (await db.query("select payload,bytes,sha256,kind,purged_at,storage_path from public.drive_files where user_id=$1 and id=$2", [b.id, upload])).rows[0];
      assert.deepEqual(stored.payload, file);
      assert.deepEqual([Number(stored.bytes), stored.sha256, stored.kind, stored.purged_at, stored.storage_path], [prepared.bytes.byteLength, prepared.sha256, "avatar", null, b.id + "/" + upload]);

      // Real canonical RPCs reject the foreign actor, without publishing a link.
      await assert.rejects(service("select public.file_avatar_set($1::uuid,$2::uuid,$3::uuid,'avatar-foreign')", [a.id, a.session, upload]), error => error?.code === "23514");
      await assert.rejects(service("select public.file_read_metadata($1::uuid,$2::uuid,$3::uuid)", [a.id, a.session, upload]), error => error?.code === "42501");
      await inRole("authenticated", async () => {
        await db.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: a.id, session_id: a.session, role: "authenticated" })]);
        assert.deepEqual((await db.query("select id from public.drive_files where id=$1", [upload])).rows, []);
      });
      assert.deepEqual((await profile(a)).rows, initialA);
      assert.deepEqual((await ledger(a)).rows[0], ledgerA);

      const linked = await service("select public.file_avatar_set($1::uuid,$2::uuid,$3::uuid,'avatar-set') as result", [b.id, b.session, upload]);
      assert.deepEqual(linked.rows[0].result, { avatar_file_id: upload });
      assert.deepEqual((await profile(b)).rows, [{ avatar_file_id: upload, avatar_url: null }]);
      const linkedSnapshot = await service("select public.settings_snapshot($1::uuid,$2::uuid) as result", [b.id, b.session]);
      assert.equal(linkedSnapshot.rows[0].result.profile.avatar_file_id, upload);

      const removed = await service("select public.file_avatar_set($1::uuid,$2::uuid,null,'avatar-remove') as result", [b.id, b.session]);
      assert.deepEqual(removed.rows[0].result, { avatar_file_id: null });
      assert.deepEqual((await profile(b)).rows, initialB);
      const removedSnapshot = await service("select public.settings_snapshot($1::uuid,$2::uuid) as result", [b.id, b.session]);
      assert.equal(removedSnapshot.rows[0].result.profile.avatar_file_id, null);
      assert.deepEqual((await db.query("select payload,purged_at from public.drive_files where user_id=$1 and id=$2", [b.id, upload])).rows, [{ payload: file, purged_at: null }]);
      const stillReadable = await service("select public.file_read_metadata($1::uuid,$2::uuid,$3::uuid) as result", [b.id, b.session, upload]);
      assert.deepEqual(stillReadable.rows[0].result.file, file);

      const finalLedgerB = (await ledger(b)).rows[0];
      assert.deepEqual(finalLedgerB, { events: ledgerB.events + 3, receipts: ledgerB.receipts + 3 });
      const receipts = (await db.query("select command,client_id,result from app_private.command_receipts where user_id=$1 order by command", [b.id])).rows;
      assert.deepEqual(receipts, [
        { command: "avatar.remove", client_id: "avatar-remove", result: { avatar_file_id: null } },
        { command: "avatar.set", client_id: "avatar-set", result: { avatar_file_id: upload } },
        { command: "file.upload.finalize", client_id: "avatar-finalize", result: file },
      ]);
      const profileEvents = (await db.query("select before,after from public.domain_events where user_id=$1 and entity_type='profile' and action='updated'", [b.id])).rows;
      assert.equal(profileEvents.length, 2);
      const setEvent = profileEvents.find(event => event.after.avatar_file_id === upload);
      const removeEvent = profileEvents.find(event => event.after.avatar_file_id === null);
      assert.equal(setEvent?.before.avatar_file_id, null);
      assert.equal(removeEvent?.before.avatar_file_id, upload);
      assert.deepEqual((await profile(a)).rows, initialA);
      assert.deepEqual((await ledger(a)).rows[0], ledgerA);
    } finally { await db.exec("rollback"); }
    assert.deepEqual((await db.query(residueSql)).rows, baselineResidues);
  } finally { input?.fill(0); prepared?.bytes.fill(0); await db.close(); }
});
