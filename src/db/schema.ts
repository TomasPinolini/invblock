import {
  pgTable,
  uuid,
  varchar,
  numeric,
  timestamp,
  pgEnum,
  index,
  text,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ── Enums ───────────────────────────────────────────────────────────────────

export const assetCategoryEnum = pgEnum("asset_category", [
  "stock",
  "cedear",
  "crypto",
  "cash",
]);

export const currencyEnum = pgEnum("currency", ["USD", "ARS"]);

export const transactionTypeEnum = pgEnum("transaction_type", [
  "buy",
  "sell",
]);

// ── Assets ──────────────────────────────────────────────────────────────────

export const assets = pgTable(
  "assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(), // FK to Supabase auth.users
    ticker: varchar("ticker", { length: 20 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    category: assetCategoryEnum("category").notNull(),
    currency: currencyEnum("currency").notNull().default("USD"),
    quantity: numeric("quantity", { precision: 18, scale: 8 })
      .notNull()
      .default("0"),
    averagePrice: numeric("average_price", { precision: 18, scale: 8 })
      .notNull()
      .default("0"),
    currentPrice: numeric("current_price", { precision: 18, scale: 8 })
      .notNull()
      .default("0"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    userIdx: index("assets_user_idx").on(table.userId),
    tickerIdx: index("assets_ticker_idx").on(table.ticker),
  })
);

// ── Transactions (Ledger) ───────────────────────────────────────────────────

export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
    type: transactionTypeEnum("type").notNull(),
    quantity: numeric("quantity", { precision: 18, scale: 8 }).notNull(),
    pricePerUnit: numeric("price_per_unit", { precision: 18, scale: 8 })
      .notNull(),
    totalAmount: numeric("total_amount", { precision: 18, scale: 8 })
      .notNull(),
    currency: currencyEnum("currency").notNull().default("USD"),
    executedAt: timestamp("executed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    notes: varchar("notes", { length: 500 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    userIdx: index("txn_user_idx").on(table.userId),
    assetIdx: index("txn_asset_idx").on(table.assetId),
    dateIdx: index("txn_date_idx").on(table.executedAt),
  })
);

// ── Relations ───────────────────────────────────────────────────────────────

export const assetsRelations = relations(assets, ({ many }) => ({
  transactions: many(transactions),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  asset: one(assets, {
    fields: [transactions.assetId],
    references: [assets.id],
  }),
}));

// ── User Connections (Broker API tokens) ────────────────────────────────────

export const userConnections = pgTable(
  "user_connections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    provider: varchar("provider", { length: 50 }).notNull(), // "iol", "binance", etc.
    credentials: text("credentials").notNull(), // JSON encrypted token data
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    userProviderIdx: index("connections_user_provider_idx").on(
      table.userId,
      table.provider
    ),
  })
);

// ── Trade Audit Log ─────────────────────────────────────────────────────────

export const tradeAuditLog = pgTable(
  "trade_audit_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    action: varchar("action", { length: 10 }).notNull(), // "buy", "sell", "cancel"
    mercado: varchar("mercado", { length: 20 }),
    simbolo: varchar("simbolo", { length: 20 }).notNull(),
    cantidad: numeric("cantidad", { precision: 18, scale: 8 }),
    precio: numeric("precio", { precision: 18, scale: 8 }),
    plazo: varchar("plazo", { length: 10 }),
    tipoOrden: varchar("tipo_orden", { length: 30 }),
    status: varchar("status", { length: 20 }).notNull(), // "attempted", "success", "failed"
    responseCode: varchar("response_code", { length: 10 }),
    responseMessage: text("response_message"),
    numeroOperacion: varchar("numero_operacion", { length: 50 }),
    ip: varchar("ip", { length: 45 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    userIdx: index("audit_user_idx").on(table.userId),
    dateIdx: index("audit_date_idx").on(table.createdAt),
    simboloIdx: index("audit_simbolo_idx").on(table.simbolo),
  })
);

export type TradeAuditEntry = typeof tradeAuditLog.$inferSelect;
export type NewTradeAuditEntry = typeof tradeAuditLog.$inferInsert;

// ── Watchlist ─────────────────────────────────────────────────────────────

export const watchlist = pgTable(
  "watchlist",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    ticker: varchar("ticker", { length: 20 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    category: assetCategoryEnum("category").notNull(),
    notes: varchar("notes", { length: 500 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    userIdx: index("watchlist_user_idx").on(table.userId),
    userTickerIdx: index("watchlist_user_ticker_idx").on(
      table.userId,
      table.ticker
    ),
  })
);

export type WatchlistItem = typeof watchlist.$inferSelect;
export type NewWatchlistItem = typeof watchlist.$inferInsert;

// Inferred types for use across the app
export type Asset = typeof assets.$inferSelect;
export type NewAsset = typeof assets.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type UserConnection = typeof userConnections.$inferSelect;
