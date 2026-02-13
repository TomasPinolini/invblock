import dynamic from "next/dynamic";
import PortfolioTable from "@/components/portfolio/PortfolioTable";
import PortfolioSummary from "@/components/portfolio/PortfolioSummary";
import AccountBalanceCards from "@/components/portfolio/AccountBalanceCards";
import AllocationBar from "@/components/portfolio/AllocationBar";
import Header from "@/components/layout/Header";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";

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

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4 sm:py-8 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="animate-fade-in-up stagger-1">
        <Header />
      </div>

      {/* Cash Balances (IOL) */}
      <div className="animate-fade-in-up stagger-2">
        <ErrorBoundary>
          <AccountBalanceCards />
        </ErrorBoundary>
      </div>

      {/* Summary Cards */}
      <div className="animate-fade-in-up stagger-3">
        <ErrorBoundary>
          <PortfolioSummary />
        </ErrorBoundary>
      </div>

      {/* Allocation Bar */}
      <div className="animate-fade-in-up stagger-4">
        <ErrorBoundary>
          <AllocationBar />
        </ErrorBoundary>
      </div>

      {/* Portfolio Advisor */}
      <div className="animate-fade-in-up stagger-5">
        <ErrorBoundary>
          <PortfolioAdvisorCard />
        </ErrorBoundary>
      </div>

      {/* Portfolio Table */}
      <div className="animate-fade-in-up stagger-6">
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
