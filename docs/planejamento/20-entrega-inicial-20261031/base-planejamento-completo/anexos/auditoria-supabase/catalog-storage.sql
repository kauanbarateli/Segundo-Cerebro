BEGIN TRANSACTION READ ONLY; SET LOCAL statement_timeout='15s'; SET LOCAL lock_timeout='3s';

SELECT id,name,public,file_size_limit,allowed_mime_types FROM storage.buckets ORDER BY id;

ROLLBACK;