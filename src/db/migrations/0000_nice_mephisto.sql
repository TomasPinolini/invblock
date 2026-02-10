CREATE TYPE "public"."asset_category" AS ENUM('stock', 'cedear', 'crypto', 'cash');--> statement-breakpoint
CREATE TYPE "public"."currency" AS ENUM('USD', 'ARS');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('buy', 'sell');--> statement-breakpoint
CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"ticker" varchar(20) NOT NULL,
	"name" varchar(120) NOT NULL,
	"category" "asset_category" NOT NULL,
	"currency" "currency" DEFAULT 'USD' NOT NULL,
	"quantity" numeric(18, 8) DEFAULT '0' NOT NULL,
	"average_price" numeric(18, 8) DEFAULT '0' NOT NULL,
	"current_price" numeric(18, 8) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trade_audit_log" (
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
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"type" "transaction_type" NOT NULL,
	"quantity" numeric(18, 8) NOT NULL,
	"price_per_unit" numeric(18, 8) NOT NULL,
	"total_amount" numeric(18, 8) NOT NULL,
	"currency" "currency" DEFAULT 'USD' NOT NULL,
	"executed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notes" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" varchar(50) NOT NULL,
	"credentials" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assets_user_idx" ON "assets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "assets_ticker_idx" ON "assets" USING btree ("ticker");--> statement-breakpoint
CREATE INDEX "audit_user_idx" ON "trade_audit_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_date_idx" ON "trade_audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_simbolo_idx" ON "trade_audit_log" USING btree ("simbolo");--> statement-breakpoint
CREATE INDEX "txn_user_idx" ON "transactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "txn_asset_idx" ON "transactions" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "txn_date_idx" ON "transactions" USING btree ("executed_at");--> statement-breakpoint
CREATE INDEX "connections_user_provider_idx" ON "user_connections" USING btree ("user_id","provider");