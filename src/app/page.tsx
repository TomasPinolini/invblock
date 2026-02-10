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
const PortfolioHealthCard = dynamic(
  () => import("@/components/portfolio/PortfolioHealthCard")
);

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4 sm:py-8 space-y-4 sm:space-y-6">
      {/* Header */}
      <Header />

      {/* Cash Balances (IOL) */}
      <ErrorBoundary>
        <AccountBalanceCards />
      </ErrorBoundary>

      {/* Summary Cards */}
      <ErrorBoundary>
        <PortfolioSummary />
      </ErrorBoundary>

      {/* Allocation Bar */}
      <ErrorBoundary>
        <AllocationBar />
      </ErrorBoundary>

      {/* Portfolio Health Score */}
      <ErrorBoundary>
        <PortfolioHealthCard />
      </ErrorBoundary>

      {/* Portfolio Table */}
      <ErrorBoundary>
        <PortfolioTable />
      </ErrorBoundary>

      {/* Dialogs (rendered globally, controlled by Zustand) */}
      <AssetEntryDialog />
      <TransactionEntryDialog />
      <PriceAlertsDialog />
    </div>
  );
}
