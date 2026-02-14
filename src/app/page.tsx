"use client";

import dynamic from "next/dynamic";
import PortfolioTable from "@/components/portfolio/PortfolioTable";
import PortfolioSummary from "@/components/portfolio/PortfolioSummary";
import AccountBalanceCards from "@/components/portfolio/AccountBalanceCards";
import Header from "@/components/layout/Header";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import { BarChart3, Sparkles, Wallet } from "lucide-react";

// Lazy-load dialogs — they're hidden by default (Zustand-controlled)
const AssetEntryDialog = dynamic(
  () => import("@/components/forms/AssetEntryDialog")
);
const TransactionEntryDialog = dynamic(
  () => import("@/components/forms/TransactionEntryDialog")
);
const PriceAlertsDialog = dynamic(
  () => import("@/components/forms/PriceAlertsDialog")
);
const PortfolioAdvisorCard = dynamic(
  () => import("@/components/portfolio/PortfolioAdvisorCard")
);
const MarketMovers = dynamic(
  () => import("@/components/market/MarketMovers")
);

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4 sm:py-8 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="animate-fade-in-up stagger-1">
        <Header />
      </div>

      {/* Collapsible: Wallet (Cash + Summary) */}
      <div className="animate-fade-in-up stagger-2">
        <ErrorBoundary>
          <CollapsibleSection
            title="Wallet"
            icon={<Wallet className="h-4 w-4 text-emerald-400" />}
          >
            <div className="grid gap-4 lg:grid-cols-[auto_1fr]">
              <AccountBalanceCards />
              <PortfolioSummary />
            </div>
          </CollapsibleSection>
        </ErrorBoundary>
      </div>

      {/* Collapsible: Market Movers + Portfolio Advisor */}
      <div className="animate-fade-in-up stagger-3 grid gap-4 md:grid-cols-2">
        <ErrorBoundary>
          <CollapsibleSection
            title="US Market Movers"
            icon={<BarChart3 className="h-4 w-4 text-blue-400" />}
          >
            <MarketMovers />
          </CollapsibleSection>
        </ErrorBoundary>
        <ErrorBoundary>
          <CollapsibleSection
            title="Portfolio Advisor"
            icon={<Sparkles className="h-4 w-4 text-amber-400" />}
          >
            <PortfolioAdvisorCard />
          </CollapsibleSection>
        </ErrorBoundary>
      </div>

      {/* Portfolio Table */}
      <div className="animate-fade-in-up stagger-4">
        <ErrorBoundary>
          <PortfolioTable />
        </ErrorBoundary>
      </div>

      {/* Dialogs (rendered globally, controlled by Zustand) */}
      <AssetEntryDialog />
      <TransactionEntryDialog />
      <PriceAlertsDialog />
    </div>
  );
}
