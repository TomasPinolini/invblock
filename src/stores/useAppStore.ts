"use client";

import { create } from "zustand";
import { persist, devtools } from "zustand/middleware";
import type { Currency, AssetCategory } from "@/lib/constants";

// ── Types ───────────────────────────────────────────────────────────────────

interface SyncStatus {
  isActive: boolean;
  lastSyncedAt: string | null; // ISO timestamp
  source: string | null; // e.g. "iol", "binance", "manual"
  error: string | null;
}

interface Preferences {
  displayCurrency: Currency; // ARS or USD — controls all value displays
  defaultCategory: AssetCategory;
  compactTable: boolean; // Dense rows vs. comfortable
}

interface AppState {
  // ── Preferences ──
  preferences: Preferences;
  setDisplayCurrency: (currency: Currency) => void;
  setDefaultCategory: (category: AssetCategory) => void;
  toggleCompactTable: () => void;

  // ── Sync Status ──
  sync: SyncStatus;
  startSync: (source: string) => void;
  completeSync: () => void;
  failSync: (error: string) => void;

  // ── UI State ──
  isAssetDialogOpen: boolean;
  isTransactionDialogOpen: boolean;
  isPriceAlertsDialogOpen: boolean;
  selectedAssetId: string | null;
  openAssetDialog: () => void;
  closeAssetDialog: () => void;
  openTransactionDialog: (assetId?: string) => void;
  closeTransactionDialog: () => void;
  openPriceAlertsDialog: () => void;
  closePriceAlertsDialog: () => void;
}

// ── Store ───────────────────────────────────────────────────────────────────

export const useAppStore = create<AppState>()(
  devtools(
    persist(
      (set) => ({
        // ── Preferences ──
        preferences: {
          displayCurrency: "USD",
          defaultCategory: "stock",
          compactTable: true, // Default to compact mode
        },
        setDisplayCurrency: (currency) =>
          set(
            (s) => ({
              preferences: { ...s.preferences, displayCurrency: currency },
            }),
            false,
            "setDisplayCurrency"
          ),
        setDefaultCategory: (category) =>
          set(
            (s) => ({
              preferences: { ...s.preferences, defaultCategory: category },
            }),
            false,
            "setDefaultCategory"
          ),
        toggleCompactTable: () =>
          set(
            (s) => ({
              preferences: {
                ...s.preferences,
                compactTable: !s.preferences.compactTable,
              },
            }),
            false,
            "toggleCompactTable"
          ),

        // ── Sync Status ──
        sync: {
          isActive: false,
          lastSyncedAt: null,
          source: null,
          error: null,
        },
        startSync: (source) =>
          set(
            { sync: { isActive: true, lastSyncedAt: null, source, error: null } },
            false,
            "startSync"
          ),
        completeSync: () =>
          set(
            (s) => ({
              sync: {
                ...s.sync,
                isActive: false,
                lastSyncedAt: new Date().toISOString(),
                error: null,
              },
            }),
            false,
            "completeSync"
          ),
        failSync: (error) =>
          set(
            (s) => ({
              sync: { ...s.sync, isActive: false, error },
            }),
            false,
            "failSync"
          ),

        // ── UI State ──
        isAssetDialogOpen: false,
        isTransactionDialogOpen: false,
        isPriceAlertsDialogOpen: false,
        selectedAssetId: null,
        openAssetDialog: () =>
          set({ isAssetDialogOpen: true }, false, "openAssetDialog"),
        closeAssetDialog: () =>
          set({ isAssetDialogOpen: false }, false, "closeAssetDialog"),
        openTransactionDialog: (assetId) =>
          set(
            {
              isTransactionDialogOpen: true,
              selectedAssetId: assetId ?? null,
            },
            false,
            "openTransactionDialog"
          ),
        closeTransactionDialog: () =>
          set(
            { isTransactionDialogOpen: false, selectedAssetId: null },
            false,
            "closeTransactionDialog"
          ),
        openPriceAlertsDialog: () =>
          set({ isPriceAlertsDialogOpen: true }, false, "openPriceAlertsDialog"),
        closePriceAlertsDialog: () =>
          set({ isPriceAlertsDialogOpen: false }, false, "closePriceAlertsDialog"),
      }),
      {
        name: "fcc-preferences",
        // Only persist preferences, not transient UI/sync state
        partialize: (state) => ({ preferences: state.preferences }),
      }
    ),
    { name: "FinancialCommandCenter" }
  )
);
