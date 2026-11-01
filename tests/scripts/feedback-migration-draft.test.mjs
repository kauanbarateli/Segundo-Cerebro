import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createCatalogueFixture } from "./helpers/catalogue-fixture.mjs";
import { CURRENT27_CANONICAL_REVIEW } from "../helpers/canonical-release-source.mjs";

test("feedback local: isolamento, replay, eventos e permissões", { timeout: 60000 }, async () => {
  const db = await createCatalogueFixture();
  try {
    for (const migration of CURRENT27_CANONICAL_REVIEW) {
      const source = await readFile(new URL(`../../supabase/migrations/${migration.file}`, import.meta.url));
      assert.equal(createHash("sha256").update(source).digest("hex"), migration.sha256);
      await db.exec(source.toString("utf8"));
    }
    await db.exec(await readFile(new URL("../../supabase/migrations/20261101013633_feedback_requests.sql", import.meta.url), "utf8"));
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
    assert.equal((await db.query("select public.feedback_list($1,$2) as value", [b, sb])).rows[0].value.length, 0);
    await assert.rejects(db.query("select public.feedback_list($1,$2)", [a, sb]), (error) => error.code === "42501");
    const { rows } = await db.query("select count(*)::int as count from public.domain_events where user_id=$1 and entity_type='feedback_request'", [a]);
    assert.equal(rows[0].count, 1);
    const event = await db.query("select after from public.domain_events where user_id=$1 and entity_type='feedback_request'", [a]);
    assert.equal(JSON.stringify(event.rows[0]).includes("Sugestão de teste"), false);
    const access = await db.query("select has_function_privilege('authenticated','public.feedback_list(uuid,uuid)','execute') as browser, has_table_privilege('authenticated','app_private.feedback_requests','select') as table_read");
    assert.deepEqual(access.rows[0], { browser: false, table_read: false });
    await db.query("update public.user_moderation set status='blocked' where user_id=$1", [a]);
    await assert.rejects(db.query("select public.feedback_list($1,$2)", [a, sa]), (error) => error.code === "42501");
  } finally { await db.close(); }
});
