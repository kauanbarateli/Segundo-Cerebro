import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("classificador reconhece PT409 exato e recusa alterações no corpo ou grants", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon nologin; create role authenticated nologin; create role service_role nologin;
      create schema app_private;
      create function app_private.onboarding_call(uuid,uuid,text,jsonb) returns jsonb
        language sql as $$ select '{}'::jsonb $$;
      create function public.onboarding_call(p_user uuid,p_session uuid,p_operation text,p_request jsonb) returns jsonb
        language sql security invoker set search_path='' as $$ select app_private.onboarding_call(p_user,p_session,p_operation,p_request) $$;
      revoke all on function public.onboarding_call(uuid,uuid,text,jsonb) from public;
      grant execute on function public.onboarding_call(uuid,uuid,text,jsonb) to service_role;
    `);
    const patch = await readFile(new URL("../../supabase/operations/onboarding-conflict-code.sql", import.meta.url), "utf8");
    const verifier = await readFile(new URL("../../supabase/operations/verify-onboarding-conflict-code.sql", import.meta.url), "utf8");
    const check = async () => (await db.exec(verifier)).flatMap((result) => result.rows).find((row) => row.jsonb_build_object)?.jsonb_build_object;
    assert.equal((await check()).ok, false, "wrapper canônico não deve ser classificado como patch");
    await db.exec(patch);
    assert.equal((await check()).ok, true);
    await db.exec("grant execute on function public.onboarding_call(uuid,uuid,text,jsonb) to authenticated");
    assert.equal((await check()).ok, false);
    await db.exec("revoke execute on function public.onboarding_call(uuid,uuid,text,jsonb) from authenticated");
    await db.exec(patch.replace("Onboarding state changed.", "A different error message."));
    assert.equal((await check()).ok, false);
  } finally {
    await db.close();
  }
});
