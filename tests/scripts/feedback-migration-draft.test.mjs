import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createCatalogueFixture } from "./helpers/catalogue-fixture.mjs";
import { CURRENT27_CANONICAL_REVIEW } from "../helpers/canonical-release-source.mjs";
import { compose } from "../../scripts/verification/front-b-feedback-reconciliation-draft/wrapper-composition.mjs";
import { withLegacyAdoption } from "../../scripts/verification/front-b-feedback-reconciliation-draft/legacy-adoption.mjs";
import { removeScratchGuard } from "../../scripts/verification/front-b-feedback-reconciliation-draft/feedback-pglite-guard.mjs";

test("feedback local: isolamento, replay, eventos e permissões", { timeout: 60000 }, async () => {
  const db = await createCatalogueFixture();
  try {
    for (const migration of CURRENT27_CANONICAL_REVIEW) {
      const source = await readFile(new URL(`../../supabase/migrations/${migration.file}`, import.meta.url));
      assert.equal(createHash("sha256").update(source).digest("hex"), migration.sha256);
      await db.exec(source.toString("utf8"));
    }
    await db.exec(await readFile(new URL("../../supabase/operations/candidates/20261101013633_feedback_requests.sql", import.meta.url), "utf8"));
    await db.exec(`
      insert into auth.users(id,email) values ('10000000-0000-4000-8000-000000000001','a@example.invalid'),('10000000-0000-4000-8000-000000000002','b@example.invalid');
      insert into auth.sessions(id,user_id) values ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001'),('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002');
    `);
    const a = "10000000-0000-4000-8000-000000000001", b = "10000000-0000-4000-8000-000000000002";
    const sa = "20000000-0000-4000-8000-000000000001", sb = "20000000-0000-4000-8000-000000000002";
    const client = "30000000-0000-4000-8000-000000000001";
    const submit = (message) => db.query("select public.feedback_submit($1,$2,$3,$4,$5) as value", [a, sa, client, "suggestion", message]);
    const first = (await submit("Sugestão de teste" )).rows[0].value;
    assert.deepEqual((await submit("Sugestão de teste")).rows[0].value, first);
    await assert.rejects(submit("Outra mensagem válida"), (error) => error.code === "23505");
    assert.equal((await db.query("select public.feedback_list($1,$2,null,null) as value", [b, sb])).rows[0].value.length, 0);
    await assert.rejects(db.query("select public.feedback_list($1,$2,null,null)", [a, sb]), (error) => error.code === "42501");
    const { rows } = await db.query("select count(*)::int as count from public.domain_events where user_id=$1 and entity_type='feedback_request'", [a]);
    assert.equal(rows[0].count, 1);
    const event = await db.query("select after from public.domain_events where user_id=$1 and entity_type='feedback_request'", [a]);
    assert.equal(JSON.stringify(event.rows[0]).includes("Sugestão de teste"), false);
    const access = await db.query("select has_function_privilege('authenticated','public.feedback_list(uuid,uuid,timestamp with time zone,uuid)','execute') as browser, has_table_privilege('authenticated','app_private.feedback_requests','select') as table_read");
    assert.deepEqual(access.rows[0], { browser: false, table_read: false });
    await db.query("insert into app_private.feedback_requests(user_id,client_id,category,message) select $1,gen_random_uuid(),'other','mensagem fictícia' from generate_series(1,60)", [a]);
    const firstPage = (await db.query("select public.feedback_list($1,$2,null,null) as value", [a, sa])).rows[0].value;
    assert.equal(firstPage.length, 51);
    const last = firstPage[49];
    const nextPage = (await db.query("select public.feedback_list($1,$2,$3,$4) as value", [a, sa, last.createdAt, last.id])).rows[0].value;
    assert.equal(nextPage.length, 11);
    assert.equal(nextPage.some((item) => firstPage.slice(0, 50).some((seen) => seen.id === item.id)), false);
    await assert.rejects(db.query("select public.feedback_list($1,$2,$3,null)", [a, sa, last.createdAt]), (error) => error.code === "22023");
    await db.query("update public.user_moderation set status='blocked' where user_id=$1", [a]);
    await assert.rejects(db.query("select public.feedback_list($1,$2,null,null)", [a, sa]), (error) => error.code === "42501");
    // Reuse this same disposable fixture; no external connection or second database.
    await db.query("update public.user_moderation set status='active' where user_id=$1", [a]);
    const path = "../../scripts/verification/front-b-feedback-reconciliation-draft/";
    const [barrier, wrappers, combined, legacy] = await Promise.all(["candidate-feedback-barrier.sql.txt", "wrappers.sql.txt", "candidate-with-wrappers.sql.txt", "candidate-legacy.sql.txt"].map((name) => readFile(new URL(path + name, import.meta.url))));
    assert.deepEqual(compose(barrier, wrappers), combined);assert.deepEqual(withLegacyAdoption(combined), legacy);
    await db.exec(removeScratchGuard(legacy.toString("utf8")));
    const states=async()=> (await db.query("select (select count(*)::int from app_private.feedback_requests) as messages,(select count(*)::int from public.domain_events where entity_type='feedback_request') as events,(select count(*)::int from app_private.feedback_barriers_draft) as barriers")).rows[0];
    const before=await states();
    const status=(await db.query("select public.feedback_barrier_status($1,$2,$3) as value",[a,sa,client])).rows[0].value;
    assert.deepEqual(status,{status:'submitted',clientId:client,feedbackId:first.id});
    assert.deepEqual(await states(),{...before,barriers:before.barriers+1});
    assert.deepEqual((await db.query("select public.feedback_barrier_cancel($1,$2,$3) as value",[a,sa,client])).rows[0].value,status);
    assert.deepEqual((await db.query("select public.feedback_barrier_submit($1,$2,$3,'suggestion',$4) as value",[a,sa,client,'Sugestão de teste'])).rows[0].value,status);
    const adopted=await states();
    await assert.rejects(db.query("select public.feedback_barrier_submit($1,$2,$3,'suggestion',$4)",[a,sa,client,'Outra mensagem válida']),(error)=>error.code==='23505');
    assert.deepEqual(await states(),adopted);
    assert.deepEqual((await db.query("select public.feedback_barrier_status($1,$2,$3) as value",[b,sb,client])).rows[0].value,{status:'unknown',clientId:client});
    await assert.rejects(db.query("select public.feedback_barrier_status($1,$2,$3)",[a,sb,client]),(error)=>error.code==='42501');
    await db.exec('set role service_role');
    try{
      await assert.rejects(db.query("select public.feedback_submit($1,$2,$3,$4,$5)",[a,sa,client,'suggestion','Sugestão de teste']),(error)=>error.code==='42501');
      assert.deepEqual((await db.query("select public.feedback_barrier_status($1,$2,$3) as value",[a,sa,client])).rows[0].value,status);
    }finally{await db.exec('reset role');}
    assert.deepEqual(await states(),adopted);
    const inconsistent='30000000-0000-4000-8000-000000000004';
    await db.exec('set role service_role');
    try{assert.deepEqual((await db.query('select public.feedback_barrier_cancel($1,$2,$3) as value',[a,sa,inconsistent])).rows[0].value,{status:'cancelled',clientId:inconsistent});}finally{await db.exec('reset role');}
    await db.query("insert into app_private.feedback_requests(user_id,client_id,category,message) values ($1,$2,'other','mensagem legada inconsistente')",[a,inconsistent]);
    const beforeInconsistent=await states();await db.exec('set role service_role');
    try{
      await assert.rejects(db.query('select public.feedback_barrier_status($1,$2,$3)',[a,sa,inconsistent]),(error)=>error.code==='55000');
      await assert.rejects(db.query('select public.feedback_barrier_cancel($1,$2,$3)',[a,sa,inconsistent]),(error)=>error.code==='55000');
      await assert.rejects(db.query("select public.feedback_barrier_submit($1,$2,$3,'other',$4)",[a,sa,inconsistent,'mensagem legada inconsistente']),(error)=>error.code==='55000');
    }finally{await db.exec('reset role');}
    assert.deepEqual(await states(),beforeInconsistent);
  } finally { await db.close(); }
});
