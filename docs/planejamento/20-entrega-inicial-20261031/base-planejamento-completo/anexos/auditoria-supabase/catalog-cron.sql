BEGIN TRANSACTION READ ONLY; SET LOCAL statement_timeout='15s'; SET LOCAL lock_timeout='3s';

SELECT j.jobid,j.jobname,j.schedule,j.active,md5(j.command) AS command_md5,
j.command ILIKE '%onboarding%' AS mentions_onboarding,
j.command ILIKE '%prune_operational_data%' AS mentions_operational_retention,
j.command ILIKE '%clickup%' AS mentions_clickup,
(SELECT count(*) FROM cron.job_run_details r WHERE r.jobid=j.jobid AND r.start_time>now()-interval '24 hours') AS runs_24h,
(SELECT count(*) FROM cron.job_run_details r WHERE r.jobid=j.jobid AND r.start_time>now()-interval '24 hours' AND r.status='succeeded') AS succeeded_24h,
(SELECT max(r.end_time) FROM cron.job_run_details r WHERE r.jobid=j.jobid AND r.status='succeeded') AS last_success
FROM cron.job j ORDER BY j.jobid;

ROLLBACK;