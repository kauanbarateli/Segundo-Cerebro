-- T021. Created with Supabase CLI migration new knowledge_pages_links.
-- NEW MIGRATION: manual application only. No reset, seed or remote execution.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
do $$ begin
  if current_user<>'postgres' or to_regprocedure('app_private.capture_task_lock(uuid)') is null
    or to_regclass('public.captures') is null then raise exception 'Apply T013/T015 foundation first as postgres.'; end if;
  if to_regclass('public.knowledge_pages') is not null or to_regclass('public.links') is not null then raise exception 'Knowledge already installed; inspect drift before applying.'; end if;
end $$;

create function app_private.knowledge_document_refs(p_doc jsonb) returns setof jsonb
language plpgsql immutable set search_path='' as $$
declare node record; token text[]; alias text;
begin
  for node in with recursive nodes(n,path) as (
    select p_doc,'{}'::integer[] union all select child.value,nodes.path||child.ordinality::integer
    from nodes cross join lateral jsonb_array_elements(coalesce(nodes.n->'content','[]'::jsonb)) with ordinality child(value,ordinality))
    select n,path from nodes order by path loop
    if node.n->>'type'='wikiLink' then
      alias:=btrim(node.n->'attrs'->>'alias');
      return next jsonb_build_object('alias',alias,'normalized_alias',app_private.knowledge_normalize(alias),'target_id',node.n->'attrs'->'target_id');
    elsif node.n->>'type'='text' then
      for token in select regexp_matches(node.n->>'text','\[\[([^\]\n]{1,200})\]\]','g') loop
        alias:=btrim(token[1]);if alias<>'' then return next jsonb_build_object('alias',alias,'normalized_alias',app_private.knowledge_normalize(alias),'target_id',null);end if;
      end loop;
    end if;
  end loop;
end $$;

create table public.knowledge_notebooks (
  id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,payload jsonb not null,
  project_id uuid,deleted_at timestamptz,deletion_batch_id uuid,created_at timestamptz not null,updated_at timestamptz not null,
  unique(user_id,id),foreign key(user_id,project_id) references public.projects(user_id,id) deferrable initially deferred,
  check((deleted_at is null)=(deletion_batch_id is null))
);
create table public.knowledge_pages (
  id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,payload jsonb not null,
  notebook_id uuid not null,parent_id uuid,origin_capture_id uuid,title text not null,normalized_title text not null,
  document jsonb not null,content_text text not null,version bigint not null check(version>0),
  deleted_at timestamptz,archived_at timestamptz,deletion_batch_id uuid,created_at timestamptz not null,updated_at timestamptz not null,
  search_vector tsvector generated always as (to_tsvector('portuguese'::regconfig,title||' '||content_text)) stored,
  unique(user_id,id),unique(user_id,origin_capture_id),
  foreign key(user_id,notebook_id) references public.knowledge_notebooks(user_id,id) deferrable initially deferred,
  foreign key(user_id,parent_id) references public.knowledge_pages(user_id,id) deferrable initially deferred,
  foreign key(user_id,origin_capture_id) references public.captures(user_id,id) deferrable initially deferred,
  check(parent_id is null or parent_id<>id),check((deleted_at is null)=(deletion_batch_id is null))
);
create unique index knowledge_pages_live_title_idx on public.knowledge_pages(user_id,normalized_title) where deleted_at is null;
create index knowledge_pages_notebook_idx on public.knowledge_pages(user_id,notebook_id,parent_id);
create index knowledge_pages_search_idx on public.knowledge_pages using gin(search_vector);
create index knowledge_notebooks_project_idx on public.knowledge_notebooks(user_id,project_id) where project_id is not null;
create table public.page_refs (
  id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,page_id uuid not null,target_id uuid,
  alias text not null check(char_length(btrim(alias)) between 1 and 200),normalized_alias text not null,created_at timestamptz not null,
  foreign key(user_id,page_id) references public.knowledge_pages(user_id,id) on delete cascade deferrable initially deferred,
  foreign key(user_id,target_id) references public.knowledge_pages(user_id,id) deferrable initially deferred,
  check(target_id is null or target_id<>page_id)
);
create unique index page_refs_resolved_idx on public.page_refs(user_id,page_id,target_id) where target_id is not null;
create unique index page_refs_pending_idx on public.page_refs(user_id,page_id,normalized_alias) where target_id is null;
create index page_refs_backlinks_idx on public.page_refs(user_id,target_id,page_id);
create table public.links (
  id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,payload jsonb not null,
  from_type text not null,from_id uuid not null,to_type text not null,to_id uuid not null,
  deleted_at timestamptz,created_at timestamptz not null,updated_at timestamptz not null,
  check(from_type in ('page','notebook','task','capture','event','file','project','transaction','habit')),
  check(to_type in ('page','notebook','task','capture','event','file','project','transaction','habit')),
  check(from_type<>to_type or from_id<>to_id),unique(user_id,from_type,from_id,to_type,to_id)
);
create index links_to_idx on public.links(user_id,to_type,to_id,from_type,from_id);
create index links_from_idx on public.links(user_id,from_type,from_id,to_type,to_id);

-- Preserve every preceding module's event types, including the financial migration.
do $$ declare expression text; begin
  select pg_get_expr(conbin,conrelid) into strict expression from pg_constraint
    where conrelid='public.domain_events'::regclass and conname='domain_events_entity_type_check';
  alter table public.domain_events drop constraint domain_events_entity_type_check;
  execute format('alter table public.domain_events add constraint domain_events_entity_type_check check ((%s) or entity_type in (''knowledge_notebook'',''knowledge_page'',''knowledge_link''))',expression);
end $$;

create function app_private.knowledge_normalize(p_text text) returns text
language sql immutable set search_path='' as $$
  select btrim(regexp_replace(lower(regexp_replace(normalize(p_text,NFD),'['||chr(768)||'-'||chr(879)||']','','g')), '\s+',' ','g'));
$$;
create function app_private.knowledge_document_text(p_node jsonb,p_depth integer default 0) returns text
language plpgsql immutable set search_path='' as $$
declare child jsonb; result text:=''; separator text:=''; part text; first_node boolean:=true; kind text:=p_node->>'type';
begin
  if p_depth>32 or jsonb_typeof(p_node) is distinct from 'object' then raise exception 'Invalid document depth.' using errcode='22023'; end if;
  if kind='text' then return p_node->>'text'; end if;
  if kind='wikiLink' then return p_node->'attrs'->>'alias'; end if;
  if kind='hardBreak' then return E'\n'; end if;
  if kind in ('doc','bulletList','orderedList','listItem','blockquote') then separator:=E'\n'; end if;
  for child in select value from jsonb_array_elements(coalesce(p_node->'content','[]'::jsonb)) loop
    part:=app_private.knowledge_document_text(child,p_depth+1);
    if not first_node then result:=result||separator; end if; first_node:=false; result:=result||coalesce(part,'');
  end loop;
  return result;
end $$;
create function app_private.knowledge_validate_document(p_doc jsonb) returns void
language plpgsql immutable set search_path='' as $$
declare entry record; n jsonb; a jsonb; m jsonb; kind text; allowed text[];
begin
  if p_doc->>'type' is distinct from 'doc' or jsonb_typeof(p_doc->'content') is distinct from 'array' or octet_length(p_doc::text)>524288 then raise exception 'Invalid document.' using errcode='22023'; end if;
  for entry in with recursive nodes(n,depth) as (select p_doc,0 union all
    select c.value,nodes.depth+1 from nodes cross join lateral jsonb_array_elements(case when jsonb_typeof(nodes.n->'content')='array' then nodes.n->'content' else '[]'::jsonb end) c where nodes.depth<33)
    select nodes.n,nodes.depth,count(*) over() total from nodes loop
    n:=entry.n;kind:=n->>'type';
    if entry.depth>32 or entry.total>10000 or jsonb_typeof(n) is distinct from 'object'
      or n-array['type','text','attrs','marks','content']<>'{}'::jsonb
      or kind is null or kind not in ('doc','paragraph','text','heading','bulletList','orderedList','listItem','blockquote','codeBlock','hardBreak','horizontalRule','wikiLink')
      or entry.depth>0 and kind='doc' then raise exception 'Invalid document node.' using errcode='22023'; end if;
    if kind='text' then
      if jsonb_typeof(n->'text') is distinct from 'string' or char_length(n->>'text')=0 or n?'content' then raise exception 'Invalid text.' using errcode='22023'; end if;
    elsif n?'text' then raise exception 'Text outside text node.' using errcode='22023'; end if;
    if n?'content' and (jsonb_typeof(n->'content')<>'array' or kind in ('text','wikiLink','hardBreak','horizontalRule')) then raise exception 'Invalid child nodes.' using errcode='22023'; end if;
    if n?'attrs' then
      a:=n->'attrs';allowed:=case kind when 'wikiLink' then array['target_id','alias'] when 'heading' then array['level'] when 'orderedList' then array['start','type'] when 'codeBlock' then array['language'] else '{}'::text[] end;
      if jsonb_typeof(a)<>'object' or a-allowed<>'{}'::jsonb then raise exception 'Invalid node attributes.' using errcode='22023'; end if;
      if kind='heading' and (jsonb_typeof(a->'level')<>'number' or (a->>'level')::numeric not in (1,2,3)) then raise exception 'Invalid heading.' using errcode='22023'; end if;
      if kind='wikiLink' and (not a?&array['target_id','alias'] or jsonb_typeof(a->'alias')<>'string' or char_length(btrim(a->>'alias')) not between 1 and 200 or (a->'target_id'<>'null'::jsonb and (a->>'target_id')!~'^[0-9a-fA-F-]{36}$')) then raise exception 'Invalid wiki link.' using errcode='22023'; end if;
    elsif kind='wikiLink' then raise exception 'Missing wiki link attributes.' using errcode='22023'; end if;
    if n?'marks' then
      if kind<>'text' or jsonb_typeof(n->'marks')<>'array' or jsonb_array_length(n->'marks')>6 then raise exception 'Invalid marks.' using errcode='22023'; end if;
      for m in select value from jsonb_array_elements(n->'marks') loop
        if jsonb_typeof(m)<>'object' or m-array['type','attrs']<>'{}'::jsonb or m->>'type' not in ('bold','italic','strike','code','underline','link') then raise exception 'Invalid mark.' using errcode='22023'; end if;
        if m?'attrs' and (m->>'type'<>'link' or jsonb_typeof(m->'attrs')<>'object' or m->'attrs'-array['href','target','rel','class']<>'{}'::jsonb or (m->'attrs'->>'href')!~'^https?://' or char_length(m->'attrs'->>'href')>2048) then raise exception 'Invalid external link.' using errcode='22023'; end if;
      end loop;
    end if;
  end loop;
end $$;

create function app_private.knowledge_guard(p_user uuid,p_session uuid,p_operation text) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform 1 from auth.users where id=p_user for share;
  perform 1 from auth.sessions where id=p_session and user_id=p_user for share;
  perform app_private.capture_task_lock(p_user);
  perform app_private.require_actor(p_user,p_session);
  if p_operation not in ('read.knowledge','knowledge.notebook.create','knowledge.notebook.update','knowledge.notebook.delete','knowledge.notebook.restore',
    'knowledge.page.create','knowledge.page.update','knowledge.page.delete','knowledge.page.restore','knowledge.page.archive','knowledge.page.unarchive','knowledge.page.resolve-ref','knowledge.page.promote-capture','knowledge.link.create','knowledge.link.delete') then raise exception 'Unknown knowledge operation.' using errcode='22023'; end if;
  if exists(select 1 from public.user_entitlements where user_id=p_user and not allowed and
    (feature_key='conhecimento' or p_operation='knowledge.page.promote-capture' and feature_key='capturar')) then raise exception 'Functionality unavailable.' using errcode='42501'; end if;
end $$;
create function app_private.knowledge_entity_table(p_type text) returns text
language sql immutable set search_path='' as $$ select case p_type when 'page' then 'knowledge_pages' when 'notebook' then 'knowledge_notebooks' when 'task' then 'tasks' when 'capture' then 'captures' when 'project' then 'projects' when 'event' then 'calendar_events' when 'file' then 'drive_files' when 'transaction' then 'fin_transactions' when 'habit' then 'habits' end; $$;
create function app_private.knowledge_entity(p_user uuid,p_type text,p_id uuid,p_live boolean default true) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare table_name text:=app_private.knowledge_entity_table(p_type); row jsonb; feature text; event_visible boolean;
begin
  feature:=case p_type when 'page' then 'conhecimento' when 'notebook' then 'conhecimento' when 'task' then 'tarefas' when 'capture' then 'capturar' when 'project' then 'projetos' when 'event' then 'calendario' when 'file' then 'drive' when 'transaction' then 'financeiro' when 'habit' then 'habitos' end;
  if feature is null or exists(select 1 from public.user_entitlements where user_id=p_user and feature_key=feature and not allowed) or table_name is null or to_regclass('public.'||table_name) is null then return null; end if;
  execute format('select to_jsonb(t) from public.%I t where user_id=$1 and id=$2',table_name) into row using p_user,p_id;
  -- File targets belong to Drive. Avatar and capture images have their own gates.
  if p_type='file' and (row->>'kind' is distinct from 'drive' or row->>'purged_at' is not null) then return null; end if;
  if p_type='event' then
    if to_regclass('public.calendar_sources') is null or to_regclass('public.calendar_accounts') is null then return null; end if;
    execute 'select exists(select 1 from public.calendar_events e join public.calendar_sources s on s.user_id=e.user_id and s.id=e.calendar_id join public.calendar_accounts a on a.user_id=s.user_id and a.id=s.account_id where e.user_id=$1 and e.id=$2 and s.selected and a.status=''connected'')' into event_visible using p_user,p_id;
    if not event_visible then return null; end if;
  end if;
  if row is null or p_live and coalesce(row->>'deleted_at',row->'payload'->>'deleted_at') is not null then return null; end if;
  return coalesce(row->'payload',row);
end $$;
create function app_private.knowledge_targets(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare typ text; table_name text; feature text; rows jsonb; result jsonb:='[]'::jsonb; base_path text;
begin
  -- Fixed one query per available module, never a query per related result.
  foreach typ in array array['task','capture','project','event','file','transaction','habit'] loop
    table_name:=app_private.knowledge_entity_table(typ);
    feature:=case typ when 'task' then 'tarefas' when 'capture' then 'capturar' when 'project' then 'projetos' when 'event' then 'calendario' when 'file' then 'drive' when 'transaction' then 'financeiro' when 'habit' then 'habitos' end;
    base_path:=case typ when 'task' then '/tarefas?task=' when 'capture' then '/capturar?capture=' when 'project' then '/projetos?project=' when 'event' then '/calendario?event=' when 'file' then '/drive?file=' when 'transaction' then '/financeiro?transaction=' when 'habit' then '/habitos?habit=' end;
    if typ='event' and (to_regclass('public.calendar_sources') is null or to_regclass('public.calendar_accounts') is null) then continue; end if;
    if to_regclass('public.'||table_name) is not null and not exists(select 1 from public.user_entitlements where user_id=p_user and feature_key=feature and not allowed) then
      execute format('select coalesce(jsonb_agg(jsonb_build_object(''type'',$2,''id'',t.id,''title'',coalesce(to_jsonb(t)->''payload''->>''title'',to_jsonb(t)->''payload''->>''name'',to_jsonb(t)->''payload''->>''description'',to_jsonb(t)->>''title'',to_jsonb(t)->>''name'',to_jsonb(t)->>''description'',''Registro''),''href'',$3||t.id::text) order by t.id),''[]''::jsonb) from public.%I t where t.user_id=$1 and coalesce(to_jsonb(t)->>''deleted_at'',to_jsonb(t)->''payload''->>''deleted_at'') is null and coalesce(to_jsonb(t)->>''archived_at'',to_jsonb(t)->''payload''->>''archived_at'') is null %s',table_name,case when typ='file' then 'and t.kind=''drive'' and t.purged_at is null' when typ='event' then 'and exists(select 1 from public.calendar_sources s join public.calendar_accounts a on a.user_id=s.user_id and a.id=s.account_id where s.user_id=t.user_id and s.id=t.calendar_id and s.selected and a.status=''connected'')' else '' end)
        into rows using p_user,typ,base_path;
      result:=result||rows;
    end if;
  end loop; return result;
end $$;

create function app_private.knowledge_row() returns trigger
language plpgsql security definer set search_path='' as $$
declare p jsonb:=new.payload; allowed text[]; kind text:=tg_table_name;
begin
  perform app_private.capture_task_lock(new.user_id);
  allowed:=case kind when 'knowledge_notebooks' then array['id','user_id','name','project_id','position','deleted_at','deletion_batch_id','created_at','updated_at']
    when 'knowledge_pages' then array['id','user_id','notebook_id','parent_id','origin_capture_id','title','normalized_title','document','content_text','version','position','archived_at','deleted_at','deletion_batch_id','created_at','updated_at']
    when 'links' then array['id','user_id','from_type','from_id','to_type','to_id','deleted_at','created_at','updated_at'] end;
  if jsonb_typeof(p)<>'object' or not p?&allowed or p-allowed<>'{}'::jsonb or p->>'id' is distinct from new.id::text or p->>'user_id' is distinct from new.user_id::text or octet_length(p::text)>600000 then raise exception 'Invalid knowledge row.' using errcode='22023'; end if;
  if tg_op='UPDATE' and (new.user_id<>old.user_id or new.id<>old.id or p->'created_at' is distinct from old.payload->'created_at') then raise exception 'Identity is immutable.' using errcode='23514'; end if;
  new.created_at:=app_private.capture_task_timestamp(p->'created_at');new.updated_at:=app_private.capture_task_timestamp(p->'updated_at');new.deleted_at:=app_private.capture_task_timestamp(p->'deleted_at',true);
  if kind='knowledge_notebooks' then
    if jsonb_typeof(p->'name')<>'string' or char_length(btrim(p->>'name')) not between 1 and 120 or jsonb_typeof(p->'position')<>'number' then raise exception 'Invalid notebook.' using errcode='22023'; end if;
    new.project_id:=(p->>'project_id')::uuid;new.deletion_batch_id:=(p->>'deletion_batch_id')::uuid;
    if new.project_id is not null and (tg_op='INSERT' or new.project_id is distinct from old.project_id) and not exists(select 1 from public.projects where user_id=new.user_id and id=new.project_id and deleted_at is null) then raise exception 'Project must be live and owned.' using errcode='23514'; end if;
  elsif kind='knowledge_pages' then
    perform app_private.knowledge_validate_document(p->'document');
    if jsonb_typeof(p->'title')<>'string' or char_length(btrim(p->>'title')) not between 1 and 200 or p->>'normalized_title' is distinct from app_private.knowledge_normalize(p->>'title') or p->>'content_text' is distinct from app_private.knowledge_document_text(p->'document') then raise exception 'Invalid page text.' using errcode='22023'; end if;
    new.notebook_id:=(p->>'notebook_id')::uuid;new.parent_id:=(p->>'parent_id')::uuid;new.origin_capture_id:=(p->>'origin_capture_id')::uuid;new.title:=p->>'title';new.normalized_title:=p->>'normalized_title';new.document:=p->'document';new.content_text:=p->>'content_text';new.version:=(p->>'version')::bigint;new.archived_at:=app_private.capture_task_timestamp(p->'archived_at',true);new.deletion_batch_id:=(p->>'deletion_batch_id')::uuid;
    if tg_op='UPDATE' and (new.origin_capture_id is distinct from old.origin_capture_id or new.version<>old.version+1) or tg_op='INSERT' and new.version<>1 then raise exception 'Invalid page version/origin.' using errcode='23514'; end if;
  else
    new.from_type:=p->>'from_type';new.from_id:=(p->>'from_id')::uuid;new.to_type:=p->>'to_type';new.to_id:=(p->>'to_id')::uuid;
    if tg_op='UPDATE' and (new.from_type<>old.from_type or new.from_id<>old.from_id or new.to_type<>old.to_type or new.to_id<>old.to_id) then raise exception 'Link identity is immutable.' using errcode='23514'; end if;
    if tg_op='INSERT' or old.deleted_at is not null and new.deleted_at is null then
      if app_private.knowledge_entity(new.user_id,new.from_type,new.from_id) is null or app_private.knowledge_entity(new.user_id,new.to_type,new.to_id) is null then raise exception 'Related record unavailable.' using errcode='23514'; end if;
    end if;
  end if;return new;
end $$;
create trigger knowledge_row before insert or update on public.knowledge_notebooks for each row execute function app_private.knowledge_row();
create trigger knowledge_row before insert or update on public.knowledge_pages for each row execute function app_private.knowledge_row();
create trigger knowledge_row before insert or update on public.links for each row execute function app_private.knowledge_row();

create function app_private.knowledge_integrity(p_user uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from public.knowledge_pages p join public.knowledge_pages parent on parent.id=p.parent_id where p.user_id=p_user and (p.notebook_id<>parent.notebook_id or p.user_id<>parent.user_id or p.deleted_at is null and parent.deleted_at is not null)) then raise exception 'Invalid page parent.' using errcode='23514'; end if;
  if exists(select 1 from public.knowledge_pages p join public.knowledge_notebooks n on n.id=p.notebook_id where p.user_id=p_user and p.deleted_at is null and n.deleted_at is not null) then raise exception 'Live page in trashed notebook.' using errcode='23514'; end if;
  if exists(with recursive paths(id,parent_id,visited,cycle) as (
    select id,parent_id,array[id],false from public.knowledge_pages where user_id=p_user union all
    select paths.id,p.parent_id,paths.visited||p.id,p.id=any(paths.visited) from paths join public.knowledge_pages p on p.id=paths.parent_id where not paths.cycle)
    select 1 from paths where cycle or cardinality(visited)>1000) then raise exception 'Cyclic/too deep page tree.' using errcode='23514'; end if;
end $$;
create function app_private.knowledge_deferred_integrity() returns trigger
language plpgsql security definer set search_path='' as $$ begin perform app_private.knowledge_integrity(case when tg_op='DELETE' then old.user_id else new.user_id end);return null;end $$;
create constraint trigger knowledge_integrity after insert or update or delete on public.knowledge_pages deferrable initially deferred for each row execute function app_private.knowledge_deferred_integrity();
create constraint trigger knowledge_integrity after insert or update or delete on public.knowledge_notebooks deferrable initially deferred for each row execute function app_private.knowledge_deferred_integrity();

create function app_private.knowledge_promoted_capture() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if tg_op='UPDATE' and (new.payload->'title' is distinct from old.payload->'title' or new.payload->'content' is distinct from old.payload->'content')
    and exists(select 1 from public.knowledge_pages where user_id=new.user_id and origin_capture_id=new.id) then
    raise exception 'Promoted capture text is historical; edit the destination page.' using errcode='23514';
  end if;return new;
end $$;
create trigger knowledge_promoted_capture before update on public.captures for each row execute function app_private.knowledge_promoted_capture();

-- Replace only in this NEW migration. Preserve the installed T015 contract and
-- add metadata for immutable promoted origins, including pages in the trash.
create or replace function app_private.capture_task_snapshot(p_user uuid,p_session uuid,p_operation text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;rows_count bigint;
begin
  perform app_private.capture_task_guard(p_user,p_session,p_operation);
  select jsonb_build_object(
    'revision',coalesce((select revision::text from app_private.capture_task_revisions where user_id=p_user),'0'),
    'captures',coalesce((select jsonb_agg(payload order by created_at,id) from public.captures where user_id=p_user),'[]'::jsonb),
    'tasks',coalesce((select jsonb_agg(payload order by created_at,id) from public.tasks where user_id=p_user),'[]'::jsonb),
    'categories',coalesce((select jsonb_agg(payload order by created_at,id) from public.categories where user_id=p_user),'[]'::jsonb),
    'projects',coalesce((select jsonb_agg(payload order by created_at,id) from public.projects where user_id=p_user),'[]'::jsonb),
    'events',coalesce((select jsonb_agg(capture_task_payload order by occurred_at,id) from public.domain_events where user_id=p_user and entity_type in ('capture','task')),'[]'::jsonb),
    'receipts',coalesce((select jsonb_agg(jsonb_build_object('user_id',rr.user_id,'command',rr.command,'client_id',rr.client_id,'fingerprint',rr.request#>>'{}','result',rr.result) order by rr.created_at,rr.command,rr.client_id)
      from app_private.command_receipts rr where rr.user_id=p_user and app_private.capture_task_command(rr.command)),'[]'::jsonb),
    'projects_visible',coalesce((select allowed from public.user_entitlements where user_id=p_user and feature_key='projetos'),true),
    'readonlyCaptureIds',coalesce((select jsonb_agg(origin_capture_id order by origin_capture_id) from public.knowledge_pages where user_id=p_user and origin_capture_id is not null),'[]'::jsonb)
  ) into result;
  select sum(jsonb_array_length(result->key)) into rows_count from unnest(array['captures','tasks','categories','projects','events','receipts','readonlyCaptureIds']) key;
  if rows_count>10000 or octet_length(result::text)>8388608 then raise exception 'Snapshot exceeds supported size.' using errcode='54000';end if;
  return result;
end $$;

-- New knowledge tables participate in the established per-user revision/lock.
do $$ declare t text; begin foreach t in array array['knowledge_notebooks','knowledge_pages','page_refs','links'] loop
  execute format('create trigger knowledge_revision after insert or update or delete on public.%I for each row execute function app_private.capture_task_bump()',t);
end loop;end $$;

create function app_private.knowledge_snapshot(p_user uuid,p_session uuid,p_operation text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb; count_rows bigint;
begin
  perform app_private.knowledge_guard(p_user,p_session,p_operation);
  select jsonb_build_object(
    'revision',coalesce((select revision::text from app_private.capture_task_revisions where user_id=p_user),'0'),
    'notebooks',coalesce((select jsonb_agg(payload order by created_at,id) from public.knowledge_notebooks where user_id=p_user),'[]'::jsonb),
    'pages',coalesce((select jsonb_agg(payload order by created_at,id) from public.knowledge_pages where user_id=p_user),'[]'::jsonb),
    'refs',coalesce((select jsonb_agg(to_jsonb(r) order by created_at,id) from public.page_refs r where user_id=p_user),'[]'::jsonb),
    'links',coalesce((select jsonb_agg(payload order by created_at,id) from public.links where user_id=p_user),'[]'::jsonb),
    'targets',app_private.knowledge_targets(p_user),
    'captures',case when p_operation='knowledge.page.promote-capture' then coalesce((select jsonb_agg(payload order by created_at,id) from public.captures where user_id=p_user),'[]'::jsonb) else '[]'::jsonb end,
    'receipts',coalesce((select jsonb_agg(jsonb_build_object('user_id',cr.user_id,'command',cr.command,'client_id',cr.client_id,'fingerprint',cr.request->'receipt'->>'fingerprint','result',cr.result) order by cr.created_at,cr.command,cr.client_id) from app_private.command_receipts cr where cr.user_id=p_user and cr.command like 'knowledge.%'),'[]'::jsonb)
  ) into result;
  select sum(jsonb_array_length(result->key)) into count_rows from unnest(array['notebooks','pages','refs','links','targets','captures','receipts']) key;
  if count_rows>10000 or octet_length(result::text)>8388608 then raise exception 'Knowledge snapshot limit; paginate before growing further.' using errcode='54000';end if;
  return result;
end $$;
create function app_private.knowledge_receipt(p_user uuid,p_session uuid,p_operation text,p_command text,p_client_id text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  perform app_private.knowledge_guard(p_user,p_session,p_operation);
  if p_command<>p_operation then raise exception 'Receipt outside operation.' using errcode='22023';end if;
  select jsonb_build_object('user_id',r.user_id,'command',r.command,'client_id',r.client_id,'fingerprint',r.request->'receipt'->>'fingerprint','result',r.result)
    into result from app_private.command_receipts r where r.user_id=p_user and r.command=p_command and r.client_id=p_client_id;
  return result;
end $$;

create function app_private.knowledge_commit(p_user uuid,p_session uuid,p_operation text,p_request jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare receipt jsonb; saved app_private.command_receipts; change jsonb; event jsonb; before_row jsonb; after_row jsonb; existing jsonb;
  table_name text; record_id uuid; kind text; rate jsonb; ref jsonb; current_revision text; matching integer; captures_changed integer:=0;
begin
  perform app_private.knowledge_guard(p_user,p_session,p_operation);
  if p_operation='read.knowledge' or jsonb_typeof(p_request)<>'object' or p_request-array['expected_revision','context','changes','refs','events','receipt']<>'{}'::jsonb
    or not p_request?&array['expected_revision','context','changes','refs','events','receipt'] or octet_length(p_request::text)>8388608
    or p_request->'context'->>'user_id' is distinct from p_user::text or p_request->'context'->>'canal' not in ('web','api','cron')
    or jsonb_typeof(p_request->'changes')<>'array' or jsonb_typeof(p_request->'refs')<>'array' or jsonb_typeof(p_request->'events')<>'array'
    or jsonb_array_length(p_request->'changes')>2000 or jsonb_array_length(p_request->'refs')>10000 then raise exception 'Invalid knowledge commit.' using errcode='22023';end if;
  receipt:=p_request->'receipt';
  if jsonb_typeof(receipt)<>'object' or receipt-array['user_id','command','client_id','fingerprint','result']<>'{}'::jsonb or receipt->>'user_id' is distinct from p_user::text or receipt->>'command' is distinct from p_operation or char_length(btrim(receipt->>'client_id')) not between 1 and 200 or char_length(receipt->>'fingerprint') not between 1 and 600000 then raise exception 'Invalid receipt.' using errcode='22023';end if;
  select * into saved from app_private.command_receipts where user_id=p_user and command=p_operation and client_id=receipt->>'client_id';
  if found then
    if saved.request->'receipt'->>'fingerprint' is distinct from receipt->>'fingerprint' then raise exception 'Conflicting replay.' using errcode='23505';end if;
    return jsonb_build_object('status','replayed','result',saved.result);
  end if;
  current_revision:=coalesce((select revision::text from app_private.capture_task_revisions where user_id=p_user),'0');
  if p_request->>'expected_revision' is distinct from current_revision then return jsonb_build_object('status','stale');end if;
  rate:=app_private.consume_rate_limit_at('capture_task_write',encode(sha256(convert_to(p_user::text,'UTF8')),'hex'),p_user,null);
  if not (rate->>'allowed')::boolean then raise exception 'Rate limited.' using errcode='PT429';end if;
  if jsonb_array_length(p_request->'changes')<>jsonb_array_length(p_request->'events') then raise exception 'Every mutation requires one event.' using errcode='23514';end if;
  for change in select value from jsonb_array_elements(p_request->'changes') loop
    if jsonb_typeof(change)<>'object' or change-array['type','before','after']<>'{}'::jsonb then raise exception 'Invalid change.' using errcode='22023';end if;
    kind:=change->>'type'; before_row:=nullif(change->'before','null'::jsonb);after_row:=nullif(change->'after','null'::jsonb);
    table_name:=case kind when 'knowledge_notebook' then 'knowledge_notebooks' when 'knowledge_page' then 'knowledge_pages' when 'knowledge_link' then 'links' when 'capture' then 'captures' end;
    if table_name is null or after_row is null or after_row->>'user_id' is distinct from p_user::text then raise exception 'Change outside owner/type.' using errcode='22023';end if;
    record_id:=(after_row->>'id')::uuid;
    select count(*) into matching from jsonb_array_elements(p_request->'events') e where e->>'entity_type'=kind and e->>'entity_id'=record_id::text and nullif(e->'before','null'::jsonb) is not distinct from before_row and nullif(e->'after','null'::jsonb) is not distinct from after_row;
    if matching<>1 or exists(select 1 from jsonb_array_elements(p_request->'changes') c where c<>change and c->>'type'=kind and c->'after'->>'id'=record_id::text) then raise exception 'Invalid matching event/duplicate change.' using errcode='23514';end if;
    execute format('select payload from public.%I where user_id=$1 and id=$2 for update',table_name) into existing using p_user,record_id;
    if existing is distinct from before_row then raise exception 'Stale/foreign knowledge row.' using errcode='40001';end if;
    if kind='capture' then
      captures_changed:=captures_changed+1;
      if p_operation<>'knowledge.page.promote-capture' or before_row is null or after_row->>'status'<>'archived' or after_row->'archived_at'='null'::jsonb or (after_row-array['status','archived_at','organized_at','updated_at']) is distinct from (before_row-array['status','archived_at','organized_at','updated_at']) then raise exception 'Invalid capture promotion.' using errcode='22023';end if;
      perform app_private.capture_task_validate_payload('capture',after_row);
      update public.captures set payload=after_row where user_id=p_user and id=record_id;
    elsif before_row is null then
      execute format('insert into public.%I(id,user_id,payload,created_at,updated_at%s) values($1,$2,$3,$4,$5%s)',table_name,
        case kind when 'knowledge_page' then ',notebook_id,title,normalized_title,document,content_text,version' when 'knowledge_link' then ',from_type,from_id,to_type,to_id' else '' end,
        case kind when 'knowledge_page' then ',($3->>''notebook_id'')::uuid,$3->>''title'',$3->>''normalized_title'',$3->''document'',$3->>''content_text'',($3->>''version'')::bigint' when 'knowledge_link' then ',$3->>''from_type'',($3->>''from_id'')::uuid,$3->>''to_type'',($3->>''to_id'')::uuid' else '' end)
        using record_id,p_user,after_row,app_private.capture_task_timestamp(after_row->'created_at'),app_private.capture_task_timestamp(after_row->'updated_at');
    else execute format('update public.%I set payload=$3 where user_id=$1 and id=$2',table_name) using p_user,record_id,after_row;end if;
  end loop;
  if captures_changed>1 or captures_changed=1 and not exists(select 1 from public.knowledge_pages p join jsonb_array_elements(p_request->'changes') c on c->>'type'='capture' and c->'after'->>'id'=p.origin_capture_id::text where p.user_id=p_user) then raise exception 'Capture promotion missing destination.' using errcode='23514';end if;
  if exists(select 1 from jsonb_array_elements(p_request->'changes') page_change where page_change->>'type'='knowledge_page' and page_change->'before'='null'::jsonb and page_change->'after'->'origin_capture_id'<>'null'::jsonb
    and (p_operation<>'knowledge.page.promote-capture' or not exists(select 1 from jsonb_array_elements(p_request->'changes') capture_change where capture_change->>'type'='capture' and capture_change->'after'->>'id'=page_change->'after'->>'origin_capture_id'))) then raise exception 'Promoted page requires its archived capture in the same command.' using errcode='23514';end if;
  perform app_private.knowledge_integrity(p_user);
  -- Match the Núcleo's derived references in one set query. Previous targets
  -- preserve identity after rename; newly created titles resolve pending refs.
  if exists(
    with raw as (select p.id page_id,r.ref,r.ordinality position from public.knowledge_pages p
      cross join lateral app_private.knowledge_document_refs(p.document) with ordinality r(ref,ordinality) where p.user_id=p_user),
    prior_refs as (select distinct on(page_id,normalized_alias) page_id,normalized_alias,target_id from public.page_refs where user_id=p_user order by page_id,normalized_alias,created_at,id),
    resolved as (select raw.page_id,raw.ref->>'alias' alias,raw.ref->>'normalized_alias' normalized_alias,
      coalesce((raw.ref->>'target_id')::uuid,old.target_id,target.id) target_id,raw.position
      from raw left join prior_refs old on old.page_id=raw.page_id and old.normalized_alias=raw.ref->>'normalized_alias'
      left join public.knowledge_pages target on target.user_id=p_user and target.deleted_at is null and target.normalized_title=raw.ref->>'normalized_alias'),
    expected as (select distinct on (page_id,coalesce(target_id::text,normalized_alias)) page_id,target_id,alias,normalized_alias from resolved
      where target_id is distinct from page_id order by page_id,coalesce(target_id::text,normalized_alias),position desc),
    supplied as (select (r->>'page_id')::uuid page_id,(r->>'target_id')::uuid target_id,r->>'alias' alias,r->>'normalized_alias' normalized_alias from jsonb_array_elements(p_request->'refs') r)
    select 1 from ((select * from expected except select * from supplied) union all (select * from supplied except select * from expected)) differences
  ) then raise exception 'References differ from document.' using errcode='23514';end if;
  for ref in select value from jsonb_array_elements(p_request->'refs') loop
    if ref-array['id','user_id','page_id','target_id','alias','normalized_alias','created_at']<>'{}'::jsonb or ref->>'user_id' is distinct from p_user::text or ref->>'normalized_alias' is distinct from app_private.knowledge_normalize(ref->>'alias') or not exists(select 1 from public.knowledge_pages where user_id=p_user and id=(ref->>'page_id')::uuid) or ref->'target_id'<>'null'::jsonb and not exists(select 1 from public.knowledge_pages where user_id=p_user and id=(ref->>'target_id')::uuid) then raise exception 'Invalid page reference.' using errcode='23514';end if;
    if exists(select 1 from public.page_refs where id=(ref->>'id')::uuid and (user_id<>p_user or page_id<>(ref->>'page_id')::uuid or created_at<>app_private.capture_task_timestamp(ref->'created_at'))) then raise exception 'Reference identity is immutable.' using errcode='23514';end if;
  end loop;
  delete from public.page_refs where user_id=p_user and id not in (select (r->>'id')::uuid from jsonb_array_elements(p_request->'refs') r);
  insert into public.page_refs(id,user_id,page_id,target_id,alias,normalized_alias,created_at)
    select (r->>'id')::uuid,p_user,(r->>'page_id')::uuid,(r->>'target_id')::uuid,r->>'alias',r->>'normalized_alias',app_private.capture_task_timestamp(r->'created_at') from jsonb_array_elements(p_request->'refs') r
    on conflict(id) do update set target_id=excluded.target_id,alias=excluded.alias,normalized_alias=excluded.normalized_alias
    where (page_refs.target_id,page_refs.alias,page_refs.normalized_alias) is distinct from (excluded.target_id,excluded.alias,excluded.normalized_alias);
  for event in select value from jsonb_array_elements(p_request->'events') loop
    if event-array['id','user_id','entity_type','entity_id','action','canal','occurred_at','before','after']<>'{}'::jsonb or event->>'user_id' is distinct from p_user::text or event->>'canal' is distinct from p_request->'context'->>'canal' or event->>'action' not in ('created','updated','deleted','restored','status_changed') or (event->>'action'='created') is distinct from (event->'before'='null'::jsonb) then raise exception 'Invalid knowledge event.' using errcode='23514';end if;
    insert into public.domain_events(id,user_id,entity_type,entity_id,action,canal,occurred_at,before,after,capture_task_payload)
      values((event->>'id')::uuid,p_user,event->>'entity_type',(event->>'entity_id')::uuid,event->>'action',event->>'canal',app_private.capture_task_timestamp(event->'occurred_at'),nullif(event->'before','null'::jsonb),nullif(event->'after','null'::jsonb),case when event->>'entity_type'='capture' then event else null end);
  end loop;
  insert into app_private.command_receipts(user_id,command,client_id,request,result) values(p_user,p_operation,receipt->>'client_id',jsonb_build_object('receipt',receipt-'result'),receipt->'result');
  perform app_private.knowledge_snapshot(p_user,p_session,p_operation);
  return jsonb_build_object('status','committed','result',receipt->'result');
end $$;

create function public.knowledge_snapshot(p_user uuid,p_session uuid,p_operation text) returns jsonb language sql security invoker set search_path='' as $$ select app_private.knowledge_snapshot(p_user,p_session,p_operation);$$;
create function public.knowledge_commit(p_user uuid,p_session uuid,p_operation text,p_request jsonb) returns jsonb language sql security invoker set search_path='' as $$ select app_private.knowledge_commit(p_user,p_session,p_operation,p_request);$$;
create function public.knowledge_receipt(p_user uuid,p_session uuid,p_operation text,p_command text,p_client_id text) returns jsonb language sql security invoker set search_path='' as $$ select app_private.knowledge_receipt(p_user,p_session,p_operation,p_command,p_client_id);$$;

-- T015 bridge: metadata only, even when Knowledge entitlement is unavailable.
-- Capture adapters use this to make promoted text read-only and skip alias
-- rewrites; no new field is injected into the byte-preserved Capture payload.
create function app_private.knowledge_capture_origins(p_user uuid,p_session uuid,p_operation text) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  if p_operation<>'read.captures' and not (p_operation like 'capture.%' and app_private.capture_task_command(p_operation)) then raise exception 'Capture operation required.' using errcode='22023';end if;
  perform app_private.capture_task_guard(p_user,p_session,p_operation);
  return coalesce((select jsonb_agg(jsonb_build_object('capture_id',origin_capture_id,'page_id',id) order by origin_capture_id) from public.knowledge_pages where user_id=p_user and origin_capture_id is not null),'[]'::jsonb);
end $$;
create function public.knowledge_capture_origins(p_user uuid,p_session uuid,p_operation text) returns jsonb
language sql security invoker set search_path='' as $$ select app_private.knowledge_capture_origins(p_user,p_session,p_operation);$$;

do $$ declare t text; fn record;begin
  foreach t in array array['knowledge_notebooks','knowledge_pages','page_refs','links'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
    execute format('grant select on public.%I to authenticated',t);
    execute format('create policy knowledge_owner_read on public.%I for select to authenticated using (user_id=(select auth.uid()) and (select app_private.has_feature(''conhecimento'')))',t);
  end loop;
  for fn in select p.oid::regprocedure::text signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','app_private') and p.proname like 'knowledge_%' loop execute format('revoke all on function %s from public,anon,authenticated,service_role',fn.signature);end loop;
end $$;
grant execute on function public.knowledge_snapshot(uuid,uuid,text),public.knowledge_commit(uuid,uuid,text,jsonb),public.knowledge_receipt(uuid,uuid,text,text,text),
  app_private.knowledge_snapshot(uuid,uuid,text),app_private.knowledge_commit(uuid,uuid,text,jsonb),app_private.knowledge_receipt(uuid,uuid,text,text,text),
  public.knowledge_capture_origins(uuid,uuid,text),app_private.knowledge_capture_origins(uuid,uuid,text) to service_role;
comment on table public.knowledge_pages is 'T021 canonical editable page. origin_capture_id is unique; capture remains frozen historical input.';
comment on table public.links is 'Closed polymorphic links with both directional indexes. Owner/existence verified by server-only commands.';
comment on function public.knowledge_commit(uuid,uuid,text,jsonb) is 'Server-only Núcleo batch; session/entitlement/replay-before-CAS; changes+refs+events+receipt atomic.';
commit;
