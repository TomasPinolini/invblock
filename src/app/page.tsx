"use client";

import dynamic from "next/dynamic";
import PortfolioTable from "@/components/portfolio/PortfolioTable";
import PortfolioSummary from "@/components/portfolio/PortfolioSummary";
import AccountBalanceCards from "@/components/portfolio/AccountBalanceCards";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import {
  BarChart3,
  Globe,
  MessageSquare,
  Newspaper,
  Sparkles,
  FileText,
  Wallet,
} from "lucide-react";

const PortfolioAdvisorCard = dynamic(
  () => import("@/components/portfolio/PortfolioAdvisorCard")
);
const MarketMovers = dynamic(
  () => import("@/components/market/MarketMovers")
);
const MacroContextCard = dynamic(
  () => import("@/components/portfolio/MacroContextCard")
);
const TradeEvaluatorCard = dynamic(
  () => import("@/components/portfolio/TradeEvaluatorCard")
);
const ExitAdvisorCard = dynamic(
  () => import("@/components/portfolio/ExitAdvisorCard")
);
const CorrelationAnalysisCard = dynamic(
  () => import("@/components/portfolio/CorrelationAnalysisCard")
);
const NewsSentiment = dynamic(
  () => import("@/components/market/NewsSentiment")
);
const ChatPanel = dynamic(
  () => import("@/components/portfolio/ChatPanel")
);
const ReportAnalyzerSection = dynamic(
  () => import("@/components/portfolio/ReportAnalyzerSection")
);

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4 sm:py-8 space-y-4 sm:space-y-6">
      {/* 1. Wallet (Cash + Summary) */}
      <div className="animate-fade-in-up stagger-1">
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

      {/* 2. Market Intelligence (2-col) */}
      <div className="animate-fade-in-up stagger-2 grid gap-4 md:grid-cols-2">
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
            title="Argentine Macro"
            icon={<Globe className="h-4 w-4 text-cyan-400" />}
            defaultOpen={false}
          >
            <MacroContextCard />
          </CollapsibleSection>
        </ErrorBoundary>
      </div>

      {/* 3. Portfolio Intelligence (2x2 grid) */}
      <div className="animate-fade-in-up stagger-3">
        <ErrorBoundary>
          <CollapsibleSection
            title="Portfolio Intelligence"
            icon={<Sparkles className="h-4 w-4 text-amber-400" />}
            defaultOpen={false}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <ErrorBoundary>
                <PortfolioAdvisorCard />
              </ErrorBoundary>
              <ErrorBoundary>
                <TradeEvaluatorCard />
              </ErrorBoundary>
              <ErrorBoundary>
                <ExitAdvisorCard />
              </ErrorBoundary>
              <ErrorBoundary>
                <CorrelationAnalysisCard />
              </ErrorBoundary>
            </div>
          </CollapsibleSection>
        </ErrorBoundary>
      </div>

      {/* 4. News & Sentiment */}
      <div className="animate-fade-in-up stagger-4">
        <ErrorBoundary>
          <CollapsibleSection
            title="News & Sentiment"
            icon={<Newspaper className="h-4 w-4 text-purple-400" />}
            defaultOpen={false}
          >
            <NewsSentiment />
          </CollapsibleSection>
        </ErrorBoundary>
      </div>

      {/* 5. Portfolio Chat */}
      <div className="animate-fade-in-up stagger-5">
        <ErrorBoundary>
          <CollapsibleSection
            title="Portfolio Chat"
            icon={<MessageSquare className="h-4 w-4 text-blue-400" />}
            defaultOpen={false}
          >
            <ChatPanel />
          </CollapsibleSection>
        </ErrorBoundary>
      </div>

      {/* 6. Report Analyzer */}
      <div className="animate-fade-in-up stagger-6">
        <ErrorBoundary>
          <CollapsibleSection
            title="Report Analyzer"
            icon={<FileText className="h-4 w-4 text-red-400" />}
            defaultOpen={false}
          >
            <ReportAnalyzerSection />
          </CollapsibleSection>
        </ErrorBoundary>
      </div>

      {/* 7. Portfolio Table (always visible) */}
      <div className="animate-fade-in-up stagger-7">
        <ErrorBoundary>
          <PortfolioTable />
        </ErrorBoundary>
      </div>
    </div>
  );
}
