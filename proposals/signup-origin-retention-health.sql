-- Supervised read-only health query; use only after the candidate is promoted.
-- Returns counts and oldest deadline, never campaign values or identifiers.
begin transaction read only;
select jsonb_build_object(
 'checked_at',now(),
 'expired_intents', (select count(*) from app_private.signup_intents where state in ('pending','bound') and expires_at<=now()),
 'oldest_intent_deadline', (select min(expires_at) from app_private.signup_intents where state in ('pending','bound') and expires_at<=now()),
 'pending_scrubs', (select count(*) from app_private.signup_intents where state='consumed' and subject_hash is not null and consumed_at<=now()-interval '24 hours'),
 'oldest_scrub_deadline', (select min(consumed_at+interval '24 hours') from app_private.signup_intents where state='consumed' and subject_hash is not null and consumed_at<=now()-interval '24 hours'),
 'expired_origins', (select count(*) from app_private.signup_origins where expires_at<=now()),
 'oldest_origin_deadline', (select min(expires_at) from app_private.signup_origins where expires_at<=now())
) as retention_health;
rollback;
