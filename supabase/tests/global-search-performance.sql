-- RECOMMENDED local target: <=500 ms/query over 50,000 owner records.
-- Disposable PostgreSQL/PGlite metadata fixture, not a hosted latency/SLA proof.
-- No file object exists; all rows, identities and measurements roll back.
begin;
set local statement_timeout='600s';set local lock_timeout='5s';
select set_config('t026.perf_user',gen_random_uuid()::text,true),set_config('t026.perf_session',gen_random_uuid()::text,true);
insert into auth.users(id,aud,role,email,is_anonymous,created_at,updated_at) values(current_setting('t026.perf_user')::uuid,'authenticated','authenticated','t026-perf-'||current_setting('t026.perf_user')||'@example.invalid',false,now(),now());
insert into auth.sessions(id,user_id,created_at,updated_at) values(current_setting('t026.perf_session')::uuid,current_setting('t026.perf_user')::uuid,now(),now());
insert into public.drive_files(id,user_id,payload,kind,name,mime,bytes,sha256,storage_path,created_at,updated_at)
select id,owner,jsonb_build_object('id',id,'user_id',owner,'kind','drive','folder_id',null,'name',name,'mime','text/plain','bytes',10,'sha256',repeat('a',64),'width',null,'height',null,'starred',false,'deleted_at',null,'deletion_batch_id',null,'created_at',now(),'updated_at',now(),'modified_at',now()),'drive',name,'text/plain',10,repeat('a',64),owner::text||'/'||id::text,now(),now()
from (select md5('disposable-search-performance:'||g)::uuid id,current_setting('t026.perf_user')::uuid owner,
 case g%5 when 0 then 'Ação planejamento '||g when 1 then 'Relatório_literal% '||g when 2 then 'Documento pessoal '||g when 3 then 'Lembrete reunião '||g else 'Arquivo especial '||g end name from generate_series(1,50000) g) fixture;
analyze public.drive_files;
create temporary table search_performance(term text not null,ms numeric not null,item_count integer not null,budget_ms integer not null default 500);
do $$declare term text;start_time timestamptz;items jsonb;iteration integer;begin
 foreach term in array array['ação','planej','Ação planejamento 50000','%','Documento pessoal','termo inexistente'] loop
  perform public.global_search(current_setting('t026.perf_user')::uuid,current_setting('t026.perf_session')::uuid,term);
  for iteration in 1..3 loop
   start_time:=clock_timestamp();items:=public.global_search(current_setting('t026.perf_user')::uuid,current_setting('t026.perf_session')::uuid,term);
   insert into search_performance(term,ms,item_count) values(term,round(extract(epoch from clock_timestamp()-start_time)*1000,3),jsonb_array_length(items));
   if jsonb_array_length(items)>70 then raise exception 'Search cap violated.';end if;
  end loop;
 end loop;
end $$;
select term,round(avg(ms),2) as mean_ms,round(max(ms),2) as max_ms,min(item_count) as item_count,500 as budget_ms,bool_and(ms<=500) as within_recommended_budget from search_performance group by term order by term;
rollback;
