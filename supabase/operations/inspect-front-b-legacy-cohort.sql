-- Read-only observation for the admission candidate's legacy guard.
-- This is a point-in-time QA/production preflight, not permission to migrate.
-- It returns only the number of distinct matching users, never identifiers.
select count(distinct u.id)::integer as contas_nao_confirmadas_ativas
from auth.users u
join auth.sessions s on s.user_id = u.id
join public.user_moderation m on m.user_id = u.id
where u.email_confirmed_at is null
  and not u.is_anonymous
  and u.deleted_at is null
  and (u.banned_until is null or u.banned_until <= now())
  and (s.not_after is null or s.not_after > now())
  and m.status = 'active'
  and not m.must_change_password
  and not exists (
    select 1 from app_private.admin_operations o
    where o.target_user_id = u.id
      and o.command = 'admin.user.create'
      and o.phase = 'complete'
  );
