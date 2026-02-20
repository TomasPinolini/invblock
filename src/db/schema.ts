import {
  pgTable,
  uuid,
  varchar,
  numeric,
  timestamp,
  pgEnum,
  index,
  integer,
  text,
  uniqueIndex,
  boolean,
  date,
  jsonb,
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
    userTickerCategoryIdx: uniqueIndex("assets_user_ticker_category_idx").on(
      table.userId,
      table.ticker,
      table.category
    ),
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

// ── Watchlist Groups ────────────────────────────────────────────────────────

export const groupColorEnum = pgEnum("group_color", [
  "red", "orange", "amber", "yellow", "lime", "green",
  "emerald", "teal", "cyan", "sky", "blue", "indigo",
  "violet", "purple", "fuchsia", "pink", "rose", "zinc",
]);

export const watchlistGroups = pgTable(
  "watchlist_groups",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    name: varchar("name", { length: 60 }).notNull(),
    color: groupColorEnum("color").notNull().default("blue"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    userIdx: index("wg_user_idx").on(table.userId),
    userNameIdx: uniqueIndex("wg_user_name_idx").on(table.userId, table.name),
  })
);

export const watchlistGroupItems = pgTable(
  "watchlist_group_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => watchlistGroups.id, { onDelete: "cascade" }),
    watchlistId: uuid("watchlist_id")
      .notNull()
      .references(() => watchlist.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
    addedAt: timestamp("added_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    groupIdx: index("wgi_group_idx").on(table.groupId),
    watchlistIdx: index("wgi_watchlist_idx").on(table.watchlistId),
    groupWatchlistIdx: uniqueIndex("wgi_group_watchlist_idx").on(
      table.groupId,
      table.watchlistId
    ),
  })
);

// ── Watchlist Relations ─────────────────────────────────────────────────────

export const watchlistRelations = relations(watchlist, ({ many }) => ({
  groupMemberships: many(watchlistGroupItems),
}));

export const watchlistGroupsRelations = relations(watchlistGroups, ({ many }) => ({
  items: many(watchlistGroupItems),
}));

export const watchlistGroupItemsRelations = relations(
  watchlistGroupItems,
  ({ one }) => ({
    group: one(watchlistGroups, {
      fields: [watchlistGroupItems.groupId],
      references: [watchlistGroups.id],
    }),
    watchlistEntry: one(watchlist, {
      fields: [watchlistGroupItems.watchlistId],
      references: [watchlist.id],
    }),
  })
);

export type WatchlistGroup = typeof watchlistGroups.$inferSelect;
export type NewWatchlistGroup = typeof watchlistGroups.$inferInsert;
export type WatchlistGroupItem = typeof watchlistGroupItems.$inferSelect;
export type NewWatchlistGroupItem = typeof watchlistGroupItems.$inferInsert;

// ── Exchange Rates (populated by mep-rate-calculator edge function) ──────────

export const exchangeRates = pgTable(
  "exchange_rates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    pair: varchar("pair", { length: 20 }).notNull(), // "USD_ARS_BLUE", "USD_ARS_MEP"
    source: varchar("source", { length: 50 }).notNull(), // "dolarapi"
    buyRate: numeric("buy_rate", { precision: 18, scale: 4 }).notNull(),
    sellRate: numeric("sell_rate", { precision: 18, scale: 4 }).notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
    sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    pairIdx: uniqueIndex("exchange_rates_pair_idx").on(table.pair),
  })
);

export type ExchangeRate = typeof exchangeRates.$inferSelect;
export type NewExchangeRate = typeof exchangeRates.$inferInsert;

// ── Ticker Price Cache (populated by watchlist-price-sync edge function) ─────

export const tickerPriceCache = pgTable(
  "ticker_price_cache",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ticker: varchar("ticker", { length: 20 }).notNull(),
    price: numeric("price", { precision: 18, scale: 8 }).notNull(),
    changePercent: numeric("change_percent", { precision: 10, scale: 4 }),
    volume: numeric("volume", { precision: 18, scale: 0 }),
    currency: varchar("currency", { length: 10 }).notNull().default("USD"),
    source: varchar("source", { length: 50 }).notNull().default("yahoo"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    tickerIdx: uniqueIndex("ticker_price_cache_ticker_idx").on(table.ticker),
  })
);

export type TickerPrice = typeof tickerPriceCache.$inferSelect;
export type NewTickerPrice = typeof tickerPriceCache.$inferInsert;

// ── Auth Events (populated by auth-activity-log edge function) ───────────────

export const authEvents = pgTable(
  "auth_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    eventType: varchar("event_type", { length: 30 }).notNull(),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    deviceHash: varchar("device_hash", { length: 64 }),
    country: varchar("country", { length: 10 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    userIdx: index("auth_events_user_idx").on(table.userId),
    dateIdx: index("auth_events_date_idx").on(table.createdAt),
    deviceIdx: index("auth_events_device_idx").on(table.userId, table.deviceHash),
  })
);

export type AuthEvent = typeof authEvents.$inferSelect;
export type NewAuthEvent = typeof authEvents.$inferInsert;

// ── User Email Preferences ────────────────────────────────────────────────────

export const userEmailPreferences = pgTable(
  "user_email_preferences",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    dailyReport: boolean("daily_report").notNull().default(true),
    weeklyDigest: boolean("weekly_digest").notNull().default(true),
    priceAlerts: boolean("price_alerts").notNull().default(true),
    securityAlerts: boolean("security_alerts").notNull().default(true),
    lastDailyReportAt: timestamp("last_daily_report_at", { withTimezone: true }),
    lastWeeklyDigestAt: timestamp("last_weekly_digest_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    userIdx: uniqueIndex("email_prefs_user_idx").on(table.userId),
  })
);

export type UserEmailPreferences = typeof userEmailPreferences.$inferSelect;
export type NewUserEmailPreferences = typeof userEmailPreferences.$inferInsert;

// ── Portfolio Snapshots (populated by portfolio-snapshot edge function) ────────

export const portfolioSnapshots = pgTable(
  "portfolio_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    snapshotDate: date("snapshot_date").notNull(),
    totalValueUsd: numeric("total_value_usd", { precision: 18, scale: 2 }).notNull(),
    totalCostUsd: numeric("total_cost_usd", { precision: 18, scale: 2 }).notNull(),
    totalPnlUsd: numeric("total_pnl_usd", { precision: 18, scale: 2 }).notNull(),
    totalPnlPercent: numeric("total_pnl_percent", { precision: 8, scale: 4 }),
    assetCount: integer("asset_count").notNull().default(0),
    byCategory: jsonb("by_category").default({}),
    positions: jsonb("positions").default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    userIdx: index("snapshots_user_idx").on(table.userId),
    dateIdx: index("snapshots_date_idx").on(table.snapshotDate),
    userDateIdx: uniqueIndex("snapshots_user_date_idx").on(table.userId, table.snapshotDate),
  })
);

export type PortfolioSnapshot = typeof portfolioSnapshots.$inferSelect;

// Inferred types for use across the app
export type Asset = typeof assets.$inferSelect;
export type NewAsset = typeof assets.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type UserConnection = typeof userConnections.$inferSelect;
