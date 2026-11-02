-- QA autorizado twrydxsdemaykgvdlpyd apenas; confirmar endpoint fora deste SQL.
-- Exemplo transacional isolado, sem dados de usuário e sem registro no ledger.
begin;
set local lock_timeout='3s';
set local statement_timeout='15s';
do $$ begin
 if to_regclass('app_private.sc_qa_aditivo_probe_134') is not null then
  raise exception 'Probe name already exists';
 end if;
end $$;
create table app_private.sc_qa_aditivo_probe_134 (id uuid primary key, created_at timestamptz not null default now());
alter table app_private.sc_qa_aditivo_probe_134 enable row level security;
revoke all on app_private.sc_qa_aditivo_probe_134 from public, anon, authenticated;
select jsonb_build_object('probe','qa_additive_transaction','rls',c.relrowsecurity,
 'anon_read',has_table_privilege('anon',c.oid,'select'),
 'authenticated_read',has_table_privilege('authenticated',c.oid,'select'),
 'existing_onboarding',to_regprocedure('public.onboarding_call(uuid,uuid,text,jsonb)') is not null)
from pg_class c where c.oid=to_regclass('app_private.sc_qa_aditivo_probe_134');
rollback;
