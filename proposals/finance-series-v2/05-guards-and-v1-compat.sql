-- INERT. In particular, do NOT install this ledger guard without B3 payment UX.
do $draft_only$ begin raise exception 'DRAFT_ONLY: managed ledger guards require supervised B3 acceptance and catalog source review.';end $draft_only$;
begin;
-- A permit is inserted only by fsv2_commit, with zero direct table/function
-- grants. It is consumed inside BEFORE, never as a reusable session flag.
create function app_private.fsv2_ledger_guard() returns trigger
language plpgsql security definer set search_path='' as $$
<<ledger_guard>>
declare owner_id uuid;row_id uuid;group_id uuid;before_value jsonb;after_value jsonb;permit app_private.finance_series_permits;managed boolean;begin
 if tg_op='DELETE' then owner_id:=old.user_id;row_id:=old.id;group_id:=old.installment_group_id;before_value:=old.payload;after_value:='null'::jsonb;
 else owner_id:=new.user_id;row_id:=new.id;group_id:=new.installment_group_id;after_value:=new.payload;before_value:=case when tg_op='UPDATE' then old.payload else 'null'::jsonb end;end if;
 -- Auth FK deletion runs AFTER the parent's removal. This narrow exception
 -- preserves authorized identity erasure; it cannot authorize an ordinary row
 -- DELETE while that user's Auth identity still exists. No GUC/role/depth flag.
 if tg_op='DELETE' and not exists(select 1 from auth.users where id=owner_id) then return old;end if;
 managed:=exists(select 1 from app_private.finance_series_occurrences m where m.transaction_id=row_id)
  or exists(select 1 from app_private.finance_series s where s.id=group_id);
 if tg_op='UPDATE' then managed:=managed or exists(select 1 from app_private.finance_series s where s.id=old.installment_group_id);end if;
 if not managed then if tg_op='DELETE' then return old;else return new;end if;end if;
 if tg_op='DELETE' or group_id is null or not exists(select 1 from app_private.finance_series s where s.user_id=owner_id and s.id=group_id) then raise exception 'Managed occurrence requires its dedicated command.' using errcode='42501';end if;
 delete from app_private.finance_series_permits p where p.row_id=ledger_guard.row_id and p.user_id=owner_id and p.series_id=group_id
  and p.backend_pid=pg_backend_pid() and p.xact_id=pg_current_xact_id()
  and p.command in ('finance.recurring.create','finance.recurring.materialize','finance.recurring.pause','finance.recurring.resume','finance.recurring.update_future','finance.recurring.end','finance.recurring.occurrence.cancel','finance.recurring.occurrence.update')
  and p.before_hash=encode(sha256(convert_to(before_value::text,'UTF8')),'hex') and p.after_hash=encode(sha256(convert_to(after_value::text,'UTF8')),'hex') returning p.* into permit;
 if not found then raise exception 'Managed occurrence has no exact unused permit.' using errcode='42501';end if;
 -- DELETE RETURNING is the authority: a second entry, even with identical data,
 -- fails. The row is already absent when legacy SET CONSTRAINTS runs. Any later
 -- failure rolls the deletion and every financial effect back in one transaction.
 return new;
end $$;
create function app_private.fsv2_permit_zero() returns trigger
language plpgsql security definer set search_path='' as $$ begin
 if exists(select 1 from app_private.finance_series_permits p where p.row_id=new.row_id) then raise exception 'Unconsumed managed occurrence permit.' using errcode='23514';end if;return null;
end $$;
create constraint trigger finance_series_permit_zero after insert or update on app_private.finance_series_permits
 deferrable initially deferred for each row execute function app_private.fsv2_permit_zero();
-- Alphabetical BEFORE order matters: finance_project establishes validated
-- scalar columns and normalizes the existing credit-card projection first.
-- This guard then hashes exactly the payload the table would persist.
create trigger finance_series_guard before insert or update or delete on public.fin_transactions
 for each row execute function app_private.fsv2_ledger_guard();

-- Account kind is ALREADY immutable for every account in finance_project.
-- Do not weaken/reimplement that historical guard. Its original test and the
-- mapped-account negative fixture remain mandatory in this candidate's QA.

-- Narrow v1 event projection only. prosrc hash comes from the ORIGINAL001–025
-- canonical chain, not a PGlite rendering or an observed untrusted deployment.
-- Root must independently confirm the hosted catalog before promotion. A
-- different source/security/owner/path aborts before replacing anything.
do $legacy_projection$
declare definition text;source text;anchor text:='entity_type like ''finance_%''';replacement text:='entity_type in (''finance_account'',''finance_category'',''finance_tag'',''finance_transaction'',''finance_budget'')';p record;begin
 select pg_get_functiondef(f.oid) definition,f.prosrc,f.prosecdef,f.proconfig,r.rolname into strict p
  from pg_proc f join pg_roles r on r.oid=f.proowner where f.oid='app_private.finance_snapshot(uuid,uuid,text)'::regprocedure;
 source:=p.prosrc;definition:=p.definition;
 if encode(sha256(convert_to(source,'UTF8')),'hex')<>'855cff15825d78f988a87f0d017e802d33b1a4808060cd9c546091a9d0e539bb'
  or not p.prosecdef or p.rolname<>'postgres' or p.proconfig is distinct from array['search_path=""']::text[]
  or (length(source)-length(replace(source,anchor,'')))/length(anchor)<>1
  or (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1
  or position(replacement in source)>0 then raise exception 'Historical Finance snapshot source diverged.' using errcode='23514';end if;
 execute replace(definition,anchor,replacement);
end $legacy_projection$;
revoke all on function app_private.fsv2_ledger_guard(),app_private.fsv2_permit_zero() from public,anon,authenticated,service_role;
rollback;
