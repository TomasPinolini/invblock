-- Financial Command Center Schema
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql

-- Create enums
CREATE TYPE asset_category AS ENUM ('stock', 'cedear', 'crypto', 'cash');
CREATE TYPE currency AS ENUM ('USD', 'ARS');
CREATE TYPE transaction_type AS ENUM ('buy', 'sell');

-- Create assets table
CREATE TABLE IF NOT EXISTS assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  ticker VARCHAR(20) NOT NULL,
  name VARCHAR(120) NOT NULL,
  category asset_category NOT NULL,
  currency currency NOT NULL DEFAULT 'USD',
  quantity NUMERIC(18, 8) NOT NULL DEFAULT 0,
  average_price NUMERIC(18, 8) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  type transaction_type NOT NULL,
  quantity NUMERIC(18, 8) NOT NULL,
  price_per_unit NUMERIC(18, 8) NOT NULL,
  total_amount NUMERIC(18, 8) NOT NULL,
  currency currency NOT NULL DEFAULT 'USD',
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS assets_user_idx ON assets(user_id);
CREATE INDEX IF NOT EXISTS assets_ticker_idx ON assets(ticker);
CREATE INDEX IF NOT EXISTS txn_user_idx ON transactions(user_id);
CREATE INDEX IF NOT EXISTS txn_asset_idx ON transactions(asset_id);
CREATE INDEX IF NOT EXISTS txn_date_idx ON transactions(executed_at);

-- User connections table (for broker API tokens)
CREATE TABLE IF NOT EXISTS user_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  provider VARCHAR(50) NOT NULL,
  credentials TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS connections_user_provider_idx ON user_connections(user_id, provider);
