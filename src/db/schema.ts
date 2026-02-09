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

// Inferred types for use across the app
export type Asset = typeof assets.$inferSelect;
export type NewAsset = typeof assets.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type UserConnection = typeof userConnections.$inferSelect;
