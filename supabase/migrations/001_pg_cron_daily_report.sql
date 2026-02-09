-- ============================================================================
-- pg_cron Setup for Daily Market Close Report
-- ============================================================================
-- Run this in Supabase SQL Editor after deploying the edge function
-- Make sure pg_cron extension is enabled first (Database > Extensions > pg_cron)

-- Enable pg_cron if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant usage to postgres user
GRANT USAGE ON SCHEMA cron TO postgres;

-- ============================================================================
-- Schedule the daily report
-- ============================================================================

-- Option 1: BCBA Market Close (17:00 ART = 20:00 UTC)
-- SELECT cron.schedule(
--   'daily-report-bcba',
--   '0 20 * * 1-5',  -- 20:00 UTC Mon-Fri (17:00 ART)
--   $$
--   SELECT net.http_post(
--     url := 'https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/daily-report',
--     headers := '{"Authorization": "Bearer <YOUR_ANON_KEY>"}'::jsonb,
--     body := '{}'::jsonb
--   ) AS request_id;
--   $$
-- );

-- Option 2: NYSE Market Close (16:00 EST = 21:00 UTC)
-- SELECT cron.schedule(
--   'daily-report-nyse',
--   '0 21 * * 1-5',  -- 21:00 UTC Mon-Fri (16:00 EST)
--   $$
--   SELECT net.http_post(
--     url := 'https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/daily-report',
--     headers := '{"Authorization": "Bearer <YOUR_ANON_KEY>"}'::jsonb,
--     body := '{}'::jsonb
--   ) AS request_id;
--   $$
-- );

-- ============================================================================
-- Useful pg_cron commands
-- ============================================================================

-- List all scheduled jobs:
-- SELECT * FROM cron.job;

-- View job run history:
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;

-- Unschedule a job:
-- SELECT cron.unschedule('daily-report-bcba');

-- ============================================================================
-- Manual test (run immediately)
-- ============================================================================

-- Test the edge function manually:
-- SELECT net.http_post(
--   url := 'https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/daily-report',
--   headers := '{"Authorization": "Bearer <YOUR_ANON_KEY>"}'::jsonb,
--   body := '{}'::jsonb
-- ) AS request_id;
