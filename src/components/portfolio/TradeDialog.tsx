"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  TrendingUp,
  TrendingDown,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import { useIOLTrade, SETTLEMENT_OPTIONS, formatOrderSummary } from "@/hooks/useIOLTrade";
import { useIOLQuote } from "@/hooks/useIOLQuotes";
import { useIOLBalance } from "@/hooks/useIOLBalance";
import { formatCurrency, cn } from "@/lib/utils";
import type { IOLSettlement } from "@/services/iol";

interface TradeDialogProps {
  asset: {
    ticker: string;
    name: string;
    category: string;
    currency: "USD" | "ARS";
    quantity: number;
    currentPrice: number;
    market?: string;
  };
  action: "buy" | "sell";
  onClose: () => void;
  onSuccess?: () => void;
}

type Step = "form" | "confirm" | "success" | "error";

export default function TradeDialog({
  asset,
  action,
  onClose,
  onSuccess,
}: TradeDialogProps) {
  const [step, setStep] = useState<Step>("form");
  const [cantidad, setCantidad] = useState<string>("");
  const [precio, setPrecio] = useState<string>(asset.currentPrice.toFixed(2));
  const [plazo, setPlazo] = useState<IOLSettlement>("t2");
  const [errorMessage, setErrorMessage] = useState<string>("");

  const tradeMutation = useIOLTrade();
  const { data: balanceData, isLoading: balanceLoading } = useIOLBalance();

  // Fetch live quote for current price
  const { data: liveQuote } = useIOLQuote(asset.ticker, asset.market, true);

  // Update price when quote changes
  useEffect(() => {
    if (liveQuote?.ultimoPrecio) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPrecio(liveQuote.ultimoPrecio.toFixed(2));
    }
  }, [liveQuote]);

  const parsedCantidad = parseInt(cantidad, 10) || 0;
  const parsedPrecio = parseFloat(precio) || 0;
  const totalAmount = parsedCantidad * parsedPrecio;

  // For sells, max quantity is what user owns
  const maxQuantity = action === "sell" ? asset.quantity : undefined;

  const market = asset.market || (asset.category === "stock" ? "nYSE" : "bCBA");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (parsedCantidad <= 0) {
      setErrorMessage("La cantidad debe ser mayor a 0");
      return;
    }

    if (parsedPrecio <= 0) {
      setErrorMessage("El precio debe ser mayor a 0");
      return;
    }

    if (action === "sell" && parsedCantidad > asset.quantity) {
      setErrorMessage(`No puedes vender más de ${asset.quantity} unidades`);
      return;
    }

    setErrorMessage("");
    setStep("confirm");
  };

  const handleConfirm = async () => {
    try {
      await tradeMutation.mutateAsync({
        action,
        mercado: market,
        simbolo: asset.ticker,
        cantidad: parsedCantidad,
        precio: parsedPrecio,
        plazo,
        validez: new Date().toISOString().split("T")[0],
        tipoOrden: "precioLimite",
      });
      setStep("success");
      onSuccess?.();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Error al ejecutar la orden"
      );
      setStep("error");
    }
  };

  const isBuy = action === "buy";
  const actionLabel = isBuy ? "Comprar" : "Vender";
  const ActionIcon = isBuy ? TrendingUp : TrendingDown;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 modal-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${actionLabel} ${asset.ticker}`}
        className="relative z-10 w-full max-w-md mx-2 sm:mx-4 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl modal-content"
      >
        {/* Header */}
        <div
          className={cn(
            "flex items-center justify-between p-4 border-b",
            isBuy ? "border-emerald-900/50 bg-emerald-950/30" : "border-red-900/50 bg-red-950/30"
          )}
        >
          <div className="flex items-center gap-3">
            <ActionIcon
              className={cn(
                "h-5 w-5",
                isBuy ? "text-emerald-400" : "text-red-400"
              )}
            />
            <div>
              <h2 className="text-lg font-bold text-zinc-100">
                {actionLabel} {asset.ticker}
              </h2>
              <p className="text-sm text-zinc-500">{asset.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <X className="h-5 w-5 text-zinc-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {step === "form" && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Available Balance */}
              {balanceLoading ? (
                <div className="bg-zinc-800/50 rounded-lg px-3 py-2 animate-pulse">
                  <div className="h-4 w-40 bg-zinc-700 rounded" />
                </div>
              ) : balanceData?.balances ? (
                <div className="bg-zinc-800/50 rounded-lg px-3 py-2 flex items-center justify-between">
                  <span className="text-xs text-zinc-500">Disponible</span>
                  <span className="text-sm font-mono text-zinc-300">
                    {formatCurrency(
                      asset.currency === "USD"
                        ? balanceData.balances.usd.disponible
                        : balanceData.balances.ars.disponible,
                      asset.currency,
                    )}
                  </span>
                </div>
              ) : null}

              {/* Current Price Info */}
              <div className="bg-zinc-800/50 rounded-lg p-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-zinc-500">Precio actual</span>
                  <span className="font-mono font-semibold text-zinc-100">
                    {formatCurrency(liveQuote?.ultimoPrecio || asset.currentPrice, asset.currency)}
                  </span>
                </div>
                {liveQuote?.variacion !== undefined && (
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-xs text-zinc-500">Variación hoy</span>
                    <span
                      className={cn(
                        "text-xs font-mono",
                        liveQuote.variacion >= 0
                          ? "text-emerald-400"
                          : "text-red-400"
                      )}
                    >
                      {liveQuote.variacion >= 0 ? "+" : ""}
                      {liveQuote.variacion.toFixed(2)}%
                    </span>
                  </div>
                )}
                {action === "sell" && (
                  <div className="flex justify-between items-center mt-1 pt-1 border-t border-zinc-700">
                    <span className="text-xs text-zinc-500">Tenencia actual</span>
                    <span className="text-xs font-mono text-zinc-400">
                      {asset.quantity} unidades
                    </span>
                  </div>
                )}
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">
                  Cantidad
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    max={maxQuantity}
                    step="1"
                    value={cantidad}
                    onChange={(e) => setCantidad(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    required
                  />
                  {action === "sell" && (
                    <button
                      type="button"
                      onClick={() => setCantidad(String(asset.quantity))}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-blue-400 hover:text-blue-300"
                    >
                      Max
                    </button>
                  )}
                </div>
              </div>

              {/* Price */}
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">
                  Precio límite ({asset.currency})
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={precio}
                  onChange={(e) => setPrecio(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  required
                />
                {parsedCantidad > 0 && parsedPrecio > 0 && (
                  <p className="text-sm text-zinc-400 font-mono mt-1">
                    Total: {formatCurrency(totalAmount, asset.currency)}
                  </p>
                )}
              </div>

              {/* Settlement */}
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">
                  Plazo de liquidación
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {SETTLEMENT_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setPlazo(option.value)}
                      className={cn(
                        "px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                        plazo === option.value
                          ? "bg-blue-600 text-white"
                          : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Total */}
              {parsedCantidad > 0 && parsedPrecio > 0 && (
                <div className="bg-zinc-800/50 rounded-lg p-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-zinc-500">
                      Total {isBuy ? "a pagar" : "a recibir"}
                    </span>
                    <span
                      className={cn(
                        "text-xl font-bold font-mono",
                        isBuy ? "text-red-400" : "text-emerald-400"
                      )}
                    >
                      {formatCurrency(totalAmount, asset.currency)}
                    </span>
                  </div>
                </div>
              )}

              {/* Error Message */}
              {errorMessage && (
                <div className="flex items-center gap-2 text-red-400 text-sm">
                  <AlertTriangle className="h-4 w-4" />
                  {errorMessage}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={parsedCantidad <= 0 || parsedPrecio <= 0}
                className={cn(
                  "w-full py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2",
                  isBuy
                    ? "bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-900"
                    : "bg-red-600 hover:bg-red-500 disabled:bg-red-900",
                  "disabled:opacity-50 disabled:cursor-not-allowed text-white"
                )}
              >
                Revisar orden
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          )}

          {step === "confirm" && (
            <div className="space-y-4">
              {/* Warning */}
              <div className="flex items-start gap-3 p-3 bg-amber-950/30 border border-amber-800/50 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-200">
                    Confirmar operación
                  </p>
                  <p className="text-xs text-amber-400/70 mt-1">
                    Esta orden se enviará a IOL para su ejecución. Una vez
                    enviada, solo podrás cancelarla si no ha sido ejecutada.
                  </p>
                </div>
              </div>

              {/* Order Summary */}
              <div className="bg-zinc-800/50 rounded-lg p-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Operación</span>
                  <span
                    className={cn(
                      "font-semibold",
                      isBuy ? "text-emerald-400" : "text-red-400"
                    )}
                  >
                    {actionLabel}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Símbolo</span>
                  <span className="font-mono text-zinc-100">{asset.ticker}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Cantidad</span>
                  <span className="font-mono text-zinc-100">{parsedCantidad}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Precio límite</span>
                  <span className="font-mono text-zinc-100">
                    {formatCurrency(parsedPrecio, asset.currency)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Plazo</span>
                  <span className="text-zinc-100">
                    {SETTLEMENT_OPTIONS.find((o) => o.value === plazo)?.label}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t border-zinc-700">
                  <span className="text-zinc-400 font-medium">Total</span>
                  <span
                    className={cn(
                      "text-lg font-bold font-mono",
                      isBuy ? "text-red-400" : "text-emerald-400"
                    )}
                  >
                    {formatCurrency(totalAmount, asset.currency)}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => setStep("form")}
                  className="flex-1 py-3 rounded-lg font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
                >
                  Volver
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={tradeMutation.isPending}
                  className={cn(
                    "flex-1 py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2",
                    isBuy
                      ? "bg-emerald-600 hover:bg-emerald-500"
                      : "bg-red-600 hover:bg-red-500",
                    "disabled:opacity-50 text-white"
                  )}
                >
                  {tradeMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      Confirmar {actionLabel}
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {step === "success" && (
            <div className="text-center py-6 space-y-4">
              <div
                className={cn(
                  "w-16 h-16 rounded-full mx-auto flex items-center justify-center",
                  isBuy ? "bg-emerald-900/50" : "bg-red-900/50"
                )}
              >
                <CheckCircle2
                  className={cn(
                    "h-8 w-8",
                    isBuy ? "text-emerald-400" : "text-red-400"
                  )}
                />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-zinc-100">
                  Orden enviada
                </h3>
                <p className="text-sm text-zinc-500 mt-1">
                  {formatOrderSummary({
                    action,
                    simbolo: asset.ticker,
                    cantidad: parsedCantidad,
                    precio: parsedPrecio,
                    plazo,
                  })}
                </p>
                {tradeMutation.data?.numeroOperacion && (
                  <p className="text-xs text-zinc-500 mt-2">
                    N° de operación: {tradeMutation.data.numeroOperacion}
                  </p>
                )}
              </div>
              <button
                onClick={onClose}
                className="w-full py-3 rounded-lg font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
              >
                Cerrar
              </button>
            </div>
          )}

          {step === "error" && (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 rounded-full bg-red-900/50 mx-auto flex items-center justify-center">
                <AlertTriangle className="h-8 w-8 text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-zinc-100">
                  Error al enviar orden
                </h3>
                <p className="text-sm text-red-400 mt-1">{errorMessage}</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setStep("form")}
                  className="flex-1 py-3 rounded-lg font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
                >
                  Reintentar
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 py-3 rounded-lg font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
