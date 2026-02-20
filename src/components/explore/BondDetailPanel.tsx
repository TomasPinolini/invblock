"use client";

import {
  CalendarDays,
  Shield,
  Scale,
  Building2,
  Briefcase,
  Banknote,
  Clock,
  ArrowLeftRight,
} from "lucide-react";
import {
  getBondMeta,
  getMaturityInfo,
  getParity,
  getBondPairSpread,
} from "@/lib/bond-metadata";
import type { BondMetadata } from "@/lib/bond-metadata";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface BondDetailPanelProps {
  ticker: string;
  currentPrice: number;
  /** Map of ticker -> price for all visible securities (needed for pair spread calc) */
  priceMap?: Map<string, number>;
}

// ---------------------------------------------------------------------------
// Lookup maps
// ---------------------------------------------------------------------------

const TYPE_LABELS: Record<BondMetadata["type"], string> = {
  soberano: "Soberano",
  corporate: "Corporate",
  lecap: "LECAP",
  boncer: "Boncer",
};

const TYPE_BADGE_CLASSES: Record<BondMetadata["type"], string> = {
  soberano: "bg-blue-500/15 text-blue-400",
  corporate: "bg-purple-500/15 text-purple-400",
  lecap: "bg-cyan-500/15 text-cyan-400",
  boncer: "bg-orange-500/15 text-orange-400",
};

const FREQUENCY_LABELS: Record<BondMetadata["couponFrequency"], string> = {
  semestral: "Semestral",
  mensual: "Mensual",
  al_vencimiento: "Al vencimiento",
  "n/a": "\u2014",
};

const CURRENCY_LABELS: Record<BondMetadata["currency"], string> = {
  USD: "D\u00f3lar (USD)",
  ARS: "Peso (ARS)",
  CER: "CER",
  "USD-linked": "D\u00f3lar linked",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatFaceValue(currency: BondMetadata["currency"], value: number): string {
  const prefix = currency === "ARS" || currency === "CER" ? "ARS" : "USD";
  return `${prefix} ${value.toLocaleString("es-AR")}`;
}

function formatPrice(price: number): string {
  return `$${price.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function InfoItem({
  icon: Icon,
  label,
  children,
  mono = false,
}: {
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement> & { className?: string }>;
  label: string;
  children: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-[11px] text-zinc-500 uppercase tracking-wider flex items-center gap-1">
        {Icon && <Icon className="h-3.5 w-3.5 text-zinc-500" />}
        {label}
      </p>
      <p className={cn("text-sm text-zinc-200 mt-0.5", mono && "font-mono")}>
        {children}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function BondDetailPanel({ ticker, currentPrice, priceMap }: BondDetailPanelProps) {
  const meta = getBondMeta(ticker);
  if (!meta) return null;

  const maturityInfo = getMaturityInfo(ticker);
  const parity = currentPrice > 0 ? getParity(ticker, currentPrice) : null;
  const spread =
    meta.type === "soberano" && meta.pairTicker && priceMap
      ? getBondPairSpread(ticker, priceMap)
      : null;

  const isCorporate = meta.type === "corporate";
  const title = isCorporate ? "Informaci\u00f3n de la ON" : "Informaci\u00f3n del bono";

  // Parity color helpers
  const parityColor =
    parity !== null
      ? parity >= 80
        ? "text-emerald-400"
        : parity >= 50
          ? "text-amber-400"
          : "text-red-400"
      : "text-zinc-400";

  return (
    <div className="bg-zinc-800/50 rounded-lg p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
          {title}
        </h3>
        <span
          className={cn(
            "text-[10px] font-medium px-2 py-0.5 rounded-full",
            TYPE_BADGE_CLASSES[meta.type]
          )}
        >
          {TYPE_LABELS[meta.type]}
        </span>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
        {/* 1. Vencimiento */}
        {maturityInfo && (
          <InfoItem icon={CalendarDays} label="Vencimiento">
            <span className={cn(maturityInfo.isExpired && "text-red-400")}>
              {maturityInfo.date}
            </span>{" "}
            <span
              className={cn(
                "text-xs",
                maturityInfo.isExpired ? "text-red-400" : "text-zinc-500"
              )}
            >
              ({maturityInfo.remaining})
            </span>
          </InfoItem>
        )}

        {/* 2. Legislacion */}
        {meta.law !== "n/a" && (
          <InfoItem icon={Shield} label="Legislaci\u00f3n">
            <span
              className={cn(
                meta.law === "argentina" && "text-blue-400",
                meta.law === "new_york" && "text-emerald-400"
              )}
            >
              {meta.law === "argentina" ? "Ley Argentina" : "Ley Nueva York"}
            </span>
          </InfoItem>
        )}

        {/* 3. Moneda */}
        <InfoItem icon={Banknote} label="Moneda">
          {CURRENCY_LABELS[meta.currency]}
        </InfoItem>

        {/* 4. Cupon */}
        <InfoItem label="Cup\u00f3n" mono>
          {meta.couponRate}
        </InfoItem>

        {/* 5. Frecuencia de pago */}
        {meta.couponFrequency !== "n/a" && (
          <InfoItem icon={Clock} label="Frecuencia de pago">
            {FREQUENCY_LABELS[meta.couponFrequency]}
          </InfoItem>
        )}

        {/* 6. Valor nominal */}
        <InfoItem label="Valor nominal" mono>
          {formatFaceValue(meta.currency, meta.faceValue)}
        </InfoItem>

        {/* 7. Paridad */}
        {parity !== null && (
          <InfoItem icon={Scale} label="Paridad" mono>
            <span className={parityColor}>{parity.toFixed(1)}%</span>
          </InfoItem>
        )}

        {/* 8. Emisor (ONs only) */}
        {isCorporate && meta.issuer && (
          <InfoItem icon={Building2} label="Emisor">
            {meta.issuer}
          </InfoItem>
        )}

        {/* 9. Sector (ONs only) */}
        {isCorporate && meta.sector && (
          <InfoItem icon={Briefcase} label="Sector">
            {meta.sector}
          </InfoItem>
        )}
      </div>

      {/* Pair spread section (sovereign bonds only) */}
      {spread && meta.pairTicker && priceMap && (
        <SpreadSection
          ticker={ticker}
          pairTicker={meta.pairTicker}
          tickerLaw={meta.law}
          tickerPrice={priceMap.get(ticker) ?? currentPrice}
          pairPrice={priceMap.get(meta.pairTicker)!}
          spread={spread.spread}
          spreadPct={spread.spreadPct}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Spread sub-section
// ---------------------------------------------------------------------------

function SpreadSection({
  ticker,
  pairTicker,
  tickerLaw,
  tickerPrice,
  pairPrice,
  spread,
  spreadPct,
}: {
  ticker: string;
  pairTicker: string;
  tickerLaw: BondMetadata["law"];
  tickerPrice: number;
  pairPrice: number;
  spread: number;
  spreadPct: number;
}) {
  // Determine which is AR and which is NY for the subtitle
  const arTicker = tickerLaw === "argentina" ? ticker : pairTicker;
  const nyTicker = tickerLaw === "argentina" ? pairTicker : ticker;

  return (
    <div className="mt-3 pt-3 border-t border-zinc-700/50">
      <p className="text-[11px] text-zinc-500 uppercase tracking-wider flex items-center gap-1 mb-2">
        <ArrowLeftRight className="h-3.5 w-3.5 text-zinc-500" />
        Spread Ley AR vs NY
      </p>
      <div className="bg-zinc-900/50 rounded-md px-3 py-2">
        <p className="text-sm text-zinc-300">
          <span className="font-mono font-medium text-blue-400">{arTicker}</span>
          <span className="text-zinc-500">: </span>
          <span className="font-mono">{formatPrice(tickerLaw === "argentina" ? tickerPrice : pairPrice)}</span>
          <span className="text-zinc-500 mx-1.5">vs</span>
          <span className="font-mono font-medium text-emerald-400">{nyTicker}</span>
          <span className="text-zinc-500">: </span>
          <span className="font-mono">{formatPrice(tickerLaw === "argentina" ? pairPrice : tickerPrice)}</span>
        </p>
        <p className="text-sm mt-1">
          <span className="text-zinc-500">Spread: </span>
          <span
            className={cn(
              "font-mono font-semibold",
              Math.abs(spreadPct) < 1
                ? "text-zinc-300"
                : spreadPct > 0
                  ? "text-amber-400"
                  : "text-emerald-400"
            )}
          >
            {formatPrice(Math.abs(spread))} ({Math.abs(spreadPct).toFixed(1)}%)
          </span>
        </p>
      </div>
    </div>
  );
}
