-- Post-016 assertions in a dedicated disposable DB; never use real accounts.
-- Only one synthetic sequence is created. ROLLBACK drops it and the helpers.
begin;
set local statement_timeout='30s';set local lock_timeout='5s';
create function pg_temp.sequence_assert(ok boolean,message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'Sequence defaults: %',message;end if;end $$;
create function pg_temp.sequence_denied(command text) returns void language plpgsql as $$
declare actual text;begin
 begin execute command;exception when others then
  get stacked diagnostics actual=returned_sqlstate;
  if actual<>'42501' then raise exception 'Expected permission denial, got %',actual;end if;return;
 end;raise exception 'Expected permission denial, command succeeded';
end $$;
do $$ declare schema_name text;begin
 perform pg_temp.sequence_assert(current_user='postgres','postgres owner required');
 perform pg_temp.sequence_assert(to_regclass('public.t016_future_sequence_probe') is null,'synthetic sequence must not preexist');
 select nspname into schema_name from pg_namespace where oid=pg_my_temp_schema();
 execute format('grant usage on schema %I to anon,authenticated,service_role',schema_name);
 execute format('grant execute on all functions in schema %I to anon,authenticated,service_role',schema_name);
end $$;
-- Ensure failures below come from the sequence ACL, not lack of schema USAGE.
grant usage on schema public to anon,authenticated,service_role;
create sequence public.t016_future_sequence_probe;
select pg_temp.sequence_assert(not exists(select 1 from pg_class c cross join lateral aclexplode(coalesce(c.relacl,acldefault('S',c.relowner))) a
 where c.oid='public.t016_future_sequence_probe'::regclass and a.grantee=0),'future sequence has no PUBLIC privileges');
select pg_temp.sequence_assert(not has_sequence_privilege('anon','public.t016_future_sequence_probe','USAGE,SELECT,UPDATE'),'future sequence closes anon');
select pg_temp.sequence_assert(not has_sequence_privilege('authenticated','public.t016_future_sequence_probe','USAGE,SELECT,UPDATE'),'future sequence closes authenticated');
select pg_temp.sequence_assert(not has_sequence_privilege('service_role','public.t016_future_sequence_probe','USAGE,SELECT,UPDATE'),'future sequence closes service_role');
select pg_temp.sequence_assert(has_sequence_privilege('postgres','public.t016_future_sequence_probe','USAGE')
 and has_sequence_privilege('postgres','public.t016_future_sequence_probe','SELECT')
 and has_sequence_privilege('postgres','public.t016_future_sequence_probe','UPDATE'),'owner retains every sequence privilege');
select pg_temp.sequence_assert(nextval('public.t016_future_sequence_probe')=1,'owner nextval works');
select pg_temp.sequence_assert(setval('public.t016_future_sequence_probe',2,true)=2,'owner setval works');
select pg_temp.sequence_assert((select last_value=2 from public.t016_future_sequence_probe),'owner SELECT works');
set local role anon;
select pg_temp.sequence_denied('select nextval(''public.t016_future_sequence_probe'')');
select pg_temp.sequence_denied('select setval(''public.t016_future_sequence_probe'',3,true)');
select pg_temp.sequence_denied('select last_value from public.t016_future_sequence_probe');
reset role;
set local role authenticated;
select pg_temp.sequence_denied('select nextval(''public.t016_future_sequence_probe'')');
select pg_temp.sequence_denied('select setval(''public.t016_future_sequence_probe'',3,true)');
select pg_temp.sequence_denied('select last_value from public.t016_future_sequence_probe');
reset role;
set local role service_role;
select pg_temp.sequence_denied('select nextval(''public.t016_future_sequence_probe'')');
select pg_temp.sequence_denied('select setval(''public.t016_future_sequence_probe'',3,true)');
select pg_temp.sequence_denied('select last_value from public.t016_future_sequence_probe');
reset role;
rollback;
