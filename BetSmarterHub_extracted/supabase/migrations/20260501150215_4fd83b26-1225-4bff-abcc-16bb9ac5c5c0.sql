-- Remove old 2-minute schedule and create 30-minute schedule
DO $$
DECLARE
  job_id BIGINT;
BEGIN
  FOR job_id IN
    SELECT jobid FROM cron.job WHERE jobname IN ('refresh-matches-cache', 'refresh-matches-every-2min')
  LOOP
    PERFORM cron.unschedule(job_id);
  END LOOP;
END $$;

SELECT cron.schedule(
  'refresh-matches-every-30min',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://odds-ace-dutch.lovable.app/api/public/refresh-matches',
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  $$
);