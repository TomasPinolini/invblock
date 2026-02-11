ALTER TABLE price_alerts
  ADD COLUMN IF NOT EXISTS narrative JSONB,
  ADD COLUMN IF NOT EXISTS narrative_generated_at TIMESTAMPTZ;
