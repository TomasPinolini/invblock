"use client";

import React, { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Bell, Plus, Trash2, TrendingUp, TrendingDown, Loader2, Pencil, Check } from "lucide-react";
import { useAppStore } from "@/stores/useAppStore";
import { useIOLPortfolio } from "@/hooks/useIOLPortfolio";
import { useBinancePortfolio } from "@/hooks/useBinancePortfolio";
import { usePriceAlerts, useCreateAlert, useUpdateAlert, useDeleteAlert } from "@/hooks/usePriceAlerts";
import { formatCurrency, cn } from "@/lib/utils";

type Condition = "above" | "below";

export default function PriceAlertsDialog() {
  const isOpen = useAppStore((s) => s.isPriceAlertsDialogOpen);
  const close = useAppStore((s) => s.closePriceAlertsDialog);

  // Fetch user's assets for the ticker dropdown
  const { data: iolPortfolio } = useIOLPortfolio();
  const { data: binancePortfolio } = useBinancePortfolio();

  // Merge assets
  const allAssets = [
    ...(iolPortfolio?.assets ?? []),
    ...(binancePortfolio?.assets ?? []),
  ];

  // Fetch existing alerts
  const { data: alertsData, isLoading: alertsLoading } = usePriceAlerts();
  const alerts = alertsData?.alerts ?? [];

  // Mutations
  const createAlert = useCreateAlert();
  const updateAlert = useUpdateAlert();
  const deleteAlert = useDeleteAlert();

  // Form state
  const [selectedTicker, setSelectedTicker] = useState("");
  const [condition, setCondition] = useState<Condition>("above");
  const [targetPrice, setTargetPrice] = useState("");

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCondition, setEditCondition] = useState<Condition>("above");
  const [editTargetPrice, setEditTargetPrice] = useState("");

  const selectedAsset = allAssets.find((a) => a.ticker === selectedTicker);

  const handleCreate = async () => {
    if (!selectedTicker || !targetPrice) return;

    await createAlert.mutateAsync({
      ticker: selectedTicker,
      condition,
      targetPrice: parseFloat(targetPrice),
    });

    // Reset form
    setSelectedTicker("");
    setTargetPrice("");
  };

  const handleDelete = async (alertId: string) => {
    await deleteAlert.mutateAsync(alertId);
  };

  const startEdit = (alert: typeof alerts[0]) => {
    setEditingId(alert.id);
    setEditCondition(alert.condition);
    setEditTargetPrice(alert.target_price.toString());
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditCondition("above");
    setEditTargetPrice("");
  };

  const handleUpdate = async () => {
    if (!editingId || !editTargetPrice) return;

    await updateAlert.mutateAsync({
      id: editingId,
      condition: editCondition,
      targetPrice: parseFloat(editTargetPrice),
    });

    cancelEdit();
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && close()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl max-h-[85vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-purple-600/20 flex items-center justify-center">
                <Bell className="h-4 w-4 text-purple-400" />
              </div>
              <div>
                <Dialog.Title className="text-lg font-bold text-zinc-100">
                  Price Alerts
                </Dialog.Title>
                <p className="text-xs text-zinc-500">
                  Get notified when prices hit your targets
                </p>
              </div>
            </div>
            <Dialog.Close asChild>
              <button className="p-1.5 rounded-lg hover:bg-zinc-800 transition-colors">
                <X className="h-5 w-5 text-zinc-400" />
              </button>
            </Dialog.Close>
          </div>

          {/* Create New Alert */}
          <div className="p-4 border-b border-zinc-800 bg-zinc-900/50">
            <p className="text-xs uppercase tracking-wider text-zinc-500 mb-3">
              Create New Alert
            </p>

            <div className="flex flex-col sm:flex-row gap-2">
              {/* Ticker Select */}
              <select
                value={selectedTicker}
                onChange={(e) => setSelectedTicker(e.target.value)}
                className="flex-1 px-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">Select asset...</option>
                {allAssets.map((asset) => (
                  <option key={asset.ticker} value={asset.ticker}>
                    {asset.ticker} - {formatCurrency(asset.currentPrice, "USD")}
                  </option>
                ))}
              </select>

              {/* Condition Toggle - Single button that switches on click */}
              <button
                type="button"
                onClick={() => setCondition(condition === "above" ? "below" : "above")}
                className={cn(
                  "px-4 py-2 text-xs font-medium rounded-lg border transition-colors flex items-center gap-1.5",
                  condition === "above"
                    ? "border-emerald-500/50 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30"
                    : "border-red-500/50 bg-red-600/20 text-red-400 hover:bg-red-600/30"
                )}
              >
                {condition === "above" ? (
                  <TrendingUp className="h-3.5 w-3.5" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5" />
                )}
                {condition === "above" ? "Above" : "Below"}
              </button>

              {/* Target Price */}
              <input
                type="number"
                step="0.01"
                placeholder="Target price"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                className="w-28 px-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />

              {/* Create Button */}
              <button
                onClick={handleCreate}
                disabled={!selectedTicker || !targetPrice || createAlert.isPending}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-purple-600 text-white hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
              >
                {createAlert.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Add
              </button>
            </div>

            {selectedAsset && (
              <p className="text-xs text-zinc-500 mt-2">
                Current price: {formatCurrency(selectedAsset.currentPrice, "USD")}
              </p>
            )}
          </div>

          {/* Existing Alerts List */}
          <div className="flex-1 overflow-y-auto p-4">
            <p className="text-xs uppercase tracking-wider text-zinc-500 mb-3">
              Active Alerts ({alerts.filter((a) => a.is_active).length})
            </p>

            {alertsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-purple-400" />
              </div>
            ) : alerts.length === 0 ? (
              <div className="text-center py-8 text-zinc-500">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No alerts yet</p>
                <p className="text-xs">Create your first price alert above</p>
              </div>
            ) : (
              <div className="space-y-2">
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg border",
                      alert.is_active
                        ? "bg-zinc-800/50 border-zinc-700"
                        : "bg-zinc-800/20 border-zinc-800 opacity-60"
                    )}
                  >
                    {editingId === alert.id ? (
                      /* Edit Mode */
                      <>
                        <div className="flex items-center gap-2 flex-1">
                          <span className="text-sm font-medium text-zinc-100">{alert.ticker}</span>
                          <button
                            type="button"
                            onClick={() => setEditCondition(editCondition === "above" ? "below" : "above")}
                            className={cn(
                              "px-2 py-1 text-xs font-medium rounded border transition-colors flex items-center gap-1",
                              editCondition === "above"
                                ? "border-emerald-500/50 bg-emerald-600/20 text-emerald-400"
                                : "border-red-500/50 bg-red-600/20 text-red-400"
                            )}
                          >
                            {editCondition === "above" ? (
                              <TrendingUp className="h-3 w-3" />
                            ) : (
                              <TrendingDown className="h-3 w-3" />
                            )}
                            {editCondition === "above" ? "Above" : "Below"}
                          </button>
                          <input
                            type="number"
                            step="0.01"
                            value={editTargetPrice}
                            onChange={(e) => setEditTargetPrice(e.target.value)}
                            className="w-24 px-2 py-1 text-sm bg-zinc-700 border border-zinc-600 rounded text-zinc-100 focus:outline-none focus:ring-1 focus:ring-purple-500"
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={handleUpdate}
                            disabled={updateAlert.isPending}
                            className="p-1.5 rounded-lg hover:bg-zinc-700 text-emerald-400 transition-colors"
                          >
                            {updateAlert.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Check className="h-4 w-4" />
                            )}
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="p-1.5 rounded-lg hover:bg-zinc-700 text-zinc-500 transition-colors"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </>
                    ) : (
                      /* View Mode */
                      <>
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              "h-8 w-8 rounded-full flex items-center justify-center",
                              alert.condition === "above"
                                ? "bg-emerald-600/20"
                                : "bg-red-600/20"
                            )}
                          >
                            {alert.condition === "above" ? (
                              <TrendingUp className="h-4 w-4 text-emerald-400" />
                            ) : (
                              <TrendingDown className="h-4 w-4 text-red-400" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-zinc-100">
                              {alert.ticker}
                              <span className="text-zinc-500 ml-1.5">
                                {alert.condition} {formatCurrency(alert.target_price, "USD")}
                              </span>
                            </p>
                            <p className="text-xs text-zinc-500">
                              {alert.is_active ? (
                                <>Current: {formatCurrency(alert.current_price || 0, "USD")}</>
                              ) : (
                                <>Triggered {new Date(alert.triggered_at!).toLocaleDateString()}</>
                              )}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          {alert.is_active && (
                            <button
                              onClick={() => startEdit(alert)}
                              className="p-1.5 rounded-lg hover:bg-zinc-700 text-zinc-500 hover:text-blue-400 transition-colors"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(alert.id)}
                            disabled={deleteAlert.isPending}
                            className="p-1.5 rounded-lg hover:bg-zinc-700 text-zinc-500 hover:text-red-400 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-zinc-800 text-xs text-zinc-600 text-center">
            Alerts are checked every 15 minutes during market hours
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
