-- 015 / T022: fair ordering of first cleanup and daily reconciliations.
-- Manual application only; 001-014 remain immutable. No Storage operation here.
begin;
set local lock_timeout='5s';set local statement_timeout='60s';
do $$ begin
 if current_user<>'postgres' or to_regprocedure('app_private.file_cleanup_candidates()') is null then
  raise exception 'Reviewed private Storage cleanup foundation required.';
 end if;
end $$;
-- A first cleanup is due at expiry; a revisit is due one day after its last ACK.
-- Only ACK advances reconciliation. Failed Storage removals remain unconfirmed.
-- CREATE OR REPLACE retains the existing function identity, owner and grants.
create or replace function app_private.file_cleanup_candidates() returns jsonb language plpgsql security definer set search_path='' as $$
declare candidate record;reservation app_private.upload_reservations;file_row public.drive_files;before_row jsonb;after_row jsonb;remove_final boolean;result_rows jsonb:='[]'::jsonb;begin
 for candidate in select r.id,r.user_id from app_private.upload_reservations r where r.expires_at<now() and (r.lease_until is null or r.lease_until<now()) and
  (r.cleaned_at is null or r.status='expired' and r.cleaned_at<now()-interval '1 day' or r.status='finalized' and exists(select 1 from public.drive_files f where f.id=r.file_id and f.user_id=r.user_id and f.kind<>'drive' and f.purged_at is null and f.created_at<now()-interval '1 day'
    and not exists(select 1 from public.profiles p where p.user_id=r.user_id and p.avatar_file_id=f.id)
    and not exists(select 1 from public.capture_file_links l where l.user_id=r.user_id and l.file_id=f.id))) order by coalesce(r.cleaned_at+interval '1 day',r.expires_at),r.expires_at,r.id limit 100 loop
  perform 1 from auth.users u where u.id=candidate.user_id for share;perform app_private.capture_task_lock(candidate.user_id);
  select r.* into reservation from app_private.upload_reservations r where r.id=candidate.id for update;if not found or reservation.expires_at>=now() or reservation.lease_until>now() then continue;end if;
  remove_final:=reservation.file_id is null;
  if reservation.file_id is not null then
   select f.* into file_row from public.drive_files f where f.user_id=reservation.user_id and f.id=reservation.file_id for update;
   if found then
    if file_row.kind<>'drive' and file_row.purged_at is null and file_row.created_at<now()-interval '1 day'
      and not exists(select 1 from public.profiles p where p.user_id=reservation.user_id and p.avatar_file_id=file_row.id)
      and not exists(select 1 from public.capture_file_links l where l.user_id=reservation.user_id and l.file_id=file_row.id) then
      remove_final:=true;
      if file_row.deleted_at is null then before_row:=file_row.payload;after_row:=before_row||jsonb_build_object('deleted_at',now(),'deletion_batch_id',gen_random_uuid(),'updated_at',now(),'modified_at',now());
       update public.drive_files f set payload=after_row where f.id=file_row.id;perform app_private.append_event(reservation.user_id,'drive_file',file_row.id,'deleted','cron',before_row,after_row);
      end if;
    end if;
   end if;
  else update app_private.upload_reservations r set status='expired',lease_id=null,lease_until=null where r.id=reservation.id;end if;
  result_rows:=result_rows||jsonb_build_array(jsonb_build_object('id',reservation.id,'staging_path',reservation.staging_path,'final_path',reservation.final_path,'remove_final',remove_final));
 end loop;return result_rows;end $$;
commit;
