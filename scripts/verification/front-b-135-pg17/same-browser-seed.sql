-- Synthetic data only, after the same-session offline instance guard.
begin;
update app_private.signup_settings set enabled=true where singleton;
insert into app_private.signup_browser_legal_versions values(true,'terms-v1','privacy-v1','origin-v1');
insert into auth.users values('10000000-0000-4000-8000-000000000001',now(),false,null,null,'{}'::jsonb);
insert into auth.sessions values('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',null);
insert into public.user_moderation values('10000000-0000-4000-8000-000000000001','active',false);
insert into app_private.signup_intents(id,user_id,subject_hash,state,expires_at,terms_version,privacy_version,origin,origin_consent_version,origin_consented_at)
 values('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',repeat('a',64),'bound',now()-interval '1 hour','terms-v1','privacy-v1','{"utm_source":"synthetic"}'::jsonb,'origin-v1',now());
insert into app_private.signup_browser_attempts(intent_id,browser_hash,expires_at)
 values('30000000-0000-4000-8000-000000000001',repeat('b',64),now()-interval '1 hour');
commit;
