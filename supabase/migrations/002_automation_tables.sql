-- ============================================================================
-- Automation Tables for Edge Functions
-- ============================================================================
-- Run this in Supabase SQL Editor

-- ============================================================================
-- 1. Price Alerts Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS price_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  ticker VARCHAR(20) NOT NULL,
  condition VARCHAR(10) NOT NULL CHECK (condition IN ('above', 'below')),
  target_price NUMERIC(18, 8) NOT NULL,
  current_price NUMERIC(18, 8),
  is_active BOOLEAN DEFAULT true,
  triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS price_alerts_user_idx ON price_alerts(user_id);
CREATE INDEX IF NOT EXISTS price_alerts_active_idx ON price_alerts(is_active) WHERE is_active = true;

-- ============================================================================
-- 2. Portfolio Snapshots Table (Historical Tracking)
-- ============================================================================

CREATE TABLE IF NOT EXISTS portfolio_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  snapshot_date DATE NOT NULL,
  total_value_usd NUMERIC(18, 2) NOT NULL,
  total_cost_usd NUMERIC(18, 2) NOT NULL,
  total_pnl_usd NUMERIC(18, 2) NOT NULL,
  total_pnl_percent NUMERIC(8, 4),
  asset_count INTEGER NOT NULL DEFAULT 0,
  -- Breakdown by category (JSONB for flexibility)
  by_category JSONB DEFAULT '{}',
  -- Individual positions snapshot
  positions JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Unique constraint: one snapshot per user per day
  UNIQUE(user_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS snapshots_user_idx ON portfolio_snapshots(user_id);
CREATE INDEX IF NOT EXISTS snapshots_date_idx ON portfolio_snapshots(snapshot_date);
CREATE INDEX IF NOT EXISTS snapshots_user_date_idx ON portfolio_snapshots(user_id, snapshot_date);

-- ============================================================================
-- 3. Function to notify edge function on transaction insert
-- ============================================================================

-- Enable the http extension for calling edge functions
CREATE EXTENSION IF NOT EXISTS http;

-- Function to call edge function on transaction insert
CREATE OR REPLACE FUNCTION notify_transaction_insert()
RETURNS TRIGGER AS $$
DECLARE
  edge_function_url TEXT;
  service_role_key TEXT;
BEGIN
  -- Get the edge function URL from environment or hardcode for now
  -- You'll need to update this with your actual project ref
  edge_function_url := 'https://fxclhazhrlkzkbjpxzlk.supabase.co/functions/v1/on-transaction';

  -- Call the edge function (fire and forget)
  PERFORM http_post(
    edge_function_url,
    json_build_object(
      'transaction_id', NEW.id,
      'user_id', NEW.user_id,
      'asset_id', NEW.asset_id,
      'type', NEW.type,
      'quantity', NEW.quantity,
      'price_per_unit', NEW.price_per_unit
    )::text,
    'application/json'
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Don't fail the transaction if edge function call fails
    RAISE WARNING 'Edge function call failed: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger (commented out - enable when ready)
-- DROP TRIGGER IF EXISTS on_transaction_insert ON transactions;
-- CREATE TRIGGER on_transaction_insert
--   AFTER INSERT ON transactions
--   FOR EACH ROW
--   EXECUTE FUNCTION notify_transaction_insert();

-- ============================================================================
-- pg_cron schedules (run after deploying edge functions)
-- ============================================================================

-- Enable pg_cron
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule price alerts check every 15 minutes during market hours (13:30-21:00 UTC = 10:30-18:00 ART)
-- SELECT cron.schedule(
--   'check-price-alerts',
--   '*/15 13-21 * * 1-5',
--   $$
--   SELECT net.http_post(
--     url := 'https://fxclhazhrlkzkbjpxzlk.supabase.co/functions/v1/price-alerts',
--     headers := '{"Authorization": "Bearer <YOUR_ANON_KEY>"}'::jsonb,
--     body := '{}'::jsonb
--   );
--   $$
-- );

-- Schedule portfolio snapshot at market close (20:00 UTC = 17:00 ART)
-- SELECT cron.schedule(
--   'daily-portfolio-snapshot',
--   '0 20 * * 1-5',
--   $$
--   SELECT net.http_post(
--     url := 'https://fxclhazhrlkzkbjpxzlk.supabase.co/functions/v1/portfolio-snapshot',
--     headers := '{"Authorization": "Bearer <YOUR_ANON_KEY>"}'::jsonb,
--     body := '{}'::jsonb
--   );
--   $$
-- );
