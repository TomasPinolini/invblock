-- Create trade_audit_log table for tracking all trade operations
-- Run manually: psql $DATABASE_URL -f src/db/migrations/create_trade_audit_log.sql

CREATE TABLE IF NOT EXISTS "trade_audit_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "action" varchar(10) NOT NULL,
  "mercado" varchar(20),
  "simbolo" varchar(20) NOT NULL,
  "cantidad" numeric(18, 8),
  "precio" numeric(18, 8),
  "plazo" varchar(10),
  "tipo_orden" varchar(30),
  "status" varchar(20) NOT NULL,
  "response_code" varchar(10),
  "response_message" text,
  "numero_operacion" varchar(50),
  "ip" varchar(45),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "audit_user_idx" ON "trade_audit_log" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "audit_date_idx" ON "trade_audit_log" USING btree ("created_at");
CREATE INDEX IF NOT EXISTS "audit_simbolo_idx" ON "trade_audit_log" USING btree ("simbolo");
