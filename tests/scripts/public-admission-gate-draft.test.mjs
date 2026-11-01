import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createCatalogueFixture } from "./helpers/catalogue-fixture.mjs";
import { CURRENT27_CANONICAL_REVIEW } from "../helpers/canonical-release-source.mjs";

test("candidata local protege novas identidades e preserva os caminhos observados", { timeout: 60000 }, async () => {
  const db = await createCatalogueFixture();
  try {
    for (const migration of CURRENT27_CANONICAL_REVIEW) {
      const source = await readFile(new URL(`../../supabase/migrations/${migration.file}`, import.meta.url));
      assert.equal(createHash("sha256").update(source).digest("hex"), migration.sha256);
      await db.exec(source.toString("utf8"));
    }
    const legacy = "10000000-0000-4000-8000-000000000001", pending = "10000000-0000-4000-8000-000000000002", direct = "10000000-0000-4000-8000-000000000003", admin = "10000000-0000-4000-8000-000000000004";
    const oldSession = "20000000-0000-4000-8000-000000000001", pendingSession = "20000000-0000-4000-8000-000000000002", directSession = "20000000-0000-4000-8000-000000000003", adminSession = "20000000-0000-4000-8000-000000000004";
    await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,'legacy@example.invalid',now()),($2,'pending@example.invalid',null)", [legacy, pending]);
    await db.query("insert into auth.sessions(id,user_id) values($1,$2),($3,$4)", [oldSession, legacy, pendingSession, pending]);
    await db.exec(await readFile(new URL("../../supabase/operations/candidates/20261101020254_public_admission_gate.sql", import.meta.url), "utf8"));
    const active = async (user, session) => (await db.query("select app_private.session_active($1,$2) as value", [user, session])).rows[0].value;
    assert.equal(await active(legacy, oldSession), true);
    assert.equal(await active(pending, pendingSession), false);
    await db.query("update auth.users set email_confirmed_at=now() where id=$1", [pending]);
    assert.equal(await active(pending, pendingSession), false);
    // Auth confirmation and editable metadata alone cannot admit a new identity.
    await db.query("insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,'direct@example.invalid',now(),'{\"role\":\"master\",\"admitted\":true}')", [direct]);
    await db.query("insert into auth.sessions(id,user_id) values($1,$2)", [directSession, direct]);
    assert.equal(await active(direct, directSession), false);
    await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ sub: direct, session_id: directSession })]);
    assert.equal((await db.query("select app_private.current_user_active() as value")).rows[0].value, false);
    await assert.rejects(db.query("select public.my_access_state()"), error => error.code === "42501");
    await db.exec("set role authenticated");
    assert.equal((await db.query("select count(*)::int as count from public.profiles")).rows[0].count, 0);
    await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ sub: legacy, session_id: oldSession })]);
    assert.equal((await db.query("select count(*)::int as count from public.profiles")).rows[0].count, 1);
    await db.exec("reset role");
    const grants = await db.query("select has_table_privilege('anon','app_private.user_admission','select') as anon, has_table_privilege('authenticated','app_private.user_admission','select') as browser");
    assert.deepEqual(grants.rows[0], { anon: false, browser: false });
    const pointer = "a".repeat(43), binding = createHash("sha256").update(pointer).digest("hex"), subject = "b".repeat(64);
    const rpc = "public.signup_intent_create(text,text,text,text,timestamp with time zone)";
    const privilege = await db.query("select has_function_privilege('anon',$1,'execute') as anon,has_function_privilege('authenticated',$1,'execute') as browser,has_function_privilege('service_role',$1,'execute') as service", [rpc]);
    assert.deepEqual(privilege.rows[0], { anon: false, browser: false, service: true });
    await assert.rejects(db.query("select public.signup_intent_create($1,$2,'v1','v1',now()-interval '1 second')", [binding, subject]), error => error.code === "22023");
    await db.exec("set role service_role");
    const intent = (await db.query("select public.signup_intent_create($1,$2,'v1','v1',now()+interval '20 minutes') as id", [binding, subject])).rows[0].id;
    await db.exec("reset role");
    // Updating metadata on an existing identity cannot manufacture a binding.
    await db.query("update auth.users set raw_user_meta_data=jsonb_build_object('sc_signup_pointer',$1::text) where id=$2", [pointer, pending]);
    assert.equal((await db.query("select state from app_private.signup_intents where id=$1", [intent])).rows[0].state, "pending");
    const newcomer = "10000000-0000-4000-8000-000000000005", replay = "10000000-0000-4000-8000-000000000006";
    await db.query("insert into auth.users(id,email,raw_user_meta_data) values($1,'new@example.invalid',jsonb_build_object('sc_signup_pointer',$2::text))", [newcomer, pointer]);
    const bindingRow = (await db.query("select state,user_id from app_private.signup_intents where id=$1", [intent])).rows[0];
    assert.deepEqual(bindingRow, { state: "bound", user_id: newcomer });
    assert.equal((await db.query("select raw_user_meta_data ? 'sc_signup_pointer' as present from auth.users where id=$1", [newcomer])).rows[0].present, false);
    await db.query("insert into auth.users(id,email,raw_user_meta_data) values($1,'replay@example.invalid',jsonb_build_object('sc_signup_pointer',$2::text))", [replay, pointer]);
    assert.equal((await db.query("select user_id from app_private.signup_intents where id=$1", [intent])).rows[0].user_id, newcomer);
    assert.equal((await db.query("select state from app_private.user_admission where user_id=$1", [newcomer])).rows[0].state, "pending");
    const expiredPointer = "z".repeat(43), expiredHash = createHash("sha256").update(expiredPointer).digest("hex");
    const expired = (await db.query("select public.signup_intent_create($1,$2,'v1','v1',now()+interval '20 minutes') as id", [expiredHash, subject])).rows[0].id;
    await db.query("update app_private.signup_intents set expires_at=now()-interval '1 second' where id=$1", [expired]);
    await db.query("insert into auth.users(id,email,raw_user_meta_data) values('10000000-0000-4000-8000-000000000007','expired@example.invalid',jsonb_build_object('sc_signup_pointer',$1::text))", [expiredPointer]);
    assert.equal((await db.query("select state from app_private.signup_intents where id=$1", [expired])).rows[0].state, "pending");
    // Synthetic operator fixture exercises the completion trigger; it does not prove the real Admin saga.
    await db.query("insert into auth.users(id,email) values($1,'admin-created@example.invalid')", [admin]);
    await db.query("insert into auth.sessions(id,user_id) values($1,$2)", [adminSession, admin]);
    const op = "30000000-0000-4000-8000-000000000001";
    await db.query("insert into app_private.admin_operations(operation_id,actor_user_id,target_user_id,command,client_id,commitment,phase,prior_status,prior_must_change_password) values($1,$2,$3,'admin.user.create','test',repeat('a',64),'revoked','active',false)", [op, legacy, admin]);
    await assert.rejects(db.query("update app_private.admin_operations set phase='complete' where operation_id=$1", [op]), error => error.code === "23514");
    await db.query("update auth.users set raw_app_meta_data=jsonb_build_object('sc_admin_operation',$1::text) where id=$2", [op, admin]);
    await db.query("update app_private.admin_operations set phase='complete' where operation_id=$1", [op]);
    assert.equal(await active(admin, adminSession), true);
    await db.query("update public.user_moderation set status='blocked' where user_id=$1", [admin]);
    assert.equal(await active(admin, adminSession), false);
    await db.query("delete from auth.sessions where id=$1", [oldSession]);
    assert.equal(await active(legacy, oldSession), false);
  } finally { await db.close(); }
});
