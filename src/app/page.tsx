import PortfolioTable from "@/components/portfolio/PortfolioTable";
import PortfolioSummary from "@/components/portfolio/PortfolioSummary";
import AllocationBar from "@/components/portfolio/AllocationBar";
import AssetEntryDialog from "@/components/forms/AssetEntryDialog";
import TransactionEntryDialog from "@/components/forms/TransactionEntryDialog";
import Header from "@/components/layout/Header";

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-8 space-y-6">
      {/* Header */}
      <Header />

      {/* Summary Cards */}
      <PortfolioSummary />

      {/* Allocation Bar */}
      <AllocationBar />

      {/* Portfolio Table */}
      <PortfolioTable />

      {/* Dialogs (rendered globally, controlled by Zustand) */}
      <AssetEntryDialog />
      <TransactionEntryDialog />
    </div>
  );
}
