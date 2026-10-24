-- INERT. Never replace historical source with an older wrapper/filter.
do $draft_only$ begin raise exception 'DRAFT_ONLY: Goals account-close guard requires supervised race and v1 acceptance.';end $draft_only$;
begin;
-- B2 already narrows the v1 snapshot. This package only verifies its exact
-- post-B2 canonical prosrc (derived from Git, not a hosted observation). No
-- CREATE OR REPLACE of finance_snapshot or fsv2_ledger_guard occurs here.
do $existing_source_gate$ declare p record;begin
 select f.prosrc,f.prosecdef,f.proconfig,r.rolname into strict p from pg_proc f join pg_roles r on r.oid=f.proowner where f.oid='app_private.finance_snapshot(uuid,uuid,text)'::regprocedure;
 if encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')<>'3bc2076d42fcfe1d140cf24783de5acd679c52d5ddd47db68ba550a96300f3fb' or not p.prosecdef or p.rolname<>'postgres' or p.proconfig is distinct from array['search_path=""']::text[] then raise exception 'Consolidated Finance snapshot source differs; compose explicitly before installing Goals.' using errcode='23514';end if;
end $existing_source_gate$;
create function app_private.fg_account_close_guard() returns trigger language plpgsql security definer set search_path='' as $$ begin
 -- The existing BEFORE finance_project validates payload, projects NEW and
 -- preserves owner/id/kind. This trigger sorts AFTER it, without rewriting it.
 -- Existing archived accounts are not retroactively rejected or changed.
 if old.archived_at is null and new.archived_at is not null then
  perform app_private.capture_task_lock(new.user_id);
  if app_private.fg_reserved(new.user_id,new.id,null)>0 then raise exception 'Release the account reservations before closing it.' using errcode='23514';end if;
 end if;return new;
end $$;
create trigger finance_reserved_balance_guard before update on public.fin_accounts for each row execute function app_private.fg_account_close_guard();
-- Prove catalog attachment/order rather than relying only on the function name.
do $trigger_gate$ declare names text[];begin
 select array_agg(tgname order by tgname) into names from pg_trigger where tgrelid='public.fin_accounts'::regclass and not tgisinternal and (tgtype&1)=1 and (tgtype&2)=2 and (tgtype&16)=16;
 if array_position(names,'finance_project') is null or array_position(names,'finance_reserved_balance_guard') is null or array_position(names,'finance_project')>=array_position(names,'finance_reserved_balance_guard') then raise exception 'Account projection must run before reservation-close guard.' using errcode='23514';end if;
end $trigger_gate$;
revoke all on function app_private.fg_account_close_guard() from public,anon,authenticated,service_role;
rollback;
