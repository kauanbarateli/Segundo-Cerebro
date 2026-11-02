-- SELECT-only operational check after the candidate table exists.
-- This verifies only the database switch. It does not check Auth, SMTP,
-- application flags, exposed routes, or authorize opening registration.
SELECT jsonb_build_object(
 'check','front_b_signup_database_gate_disabled',
 'ok',NOT EXISTS (SELECT 1 FROM app_private.signup_settings WHERE singleton AND enabled)
) AS result;
