"use client";

import { useState, useRef, useEffect } from "react";
import {
  MessageSquare,
  Send,
  Loader2,
  Trash2,
  Square,
  Bot,
  User,
} from "lucide-react";
import { useChatInsights, type PortfolioAsset } from "@/hooks/useChatInsights";
import { usePortfolioData } from "@/hooks/usePortfolioData";
import { cn } from "@/lib/utils";
import type { PortfolioRow } from "@/components/portfolio/columns";

// ── Helpers ──────────────────────────────────────────────────────────────────

function mapRowsToChat(rows: PortfolioRow[]): PortfolioAsset[] {
  return rows.map((row) => ({
    ticker: row.ticker,
    name: row.name,
    category: row.category,
    currency: row.currency,
    quantity: row.quantity,
    currentValue: row.currentValue,
    pnl: row.pnl,
    pnlPercent: row.pnlPercent,
    allocation: row.allocation,
  }));
}

/** Simple markdown rendering — bold, code, and lists */
function renderMarkdown(text: string) {
  return text.split("\n").map((line, i) => {
    // Bullet list
    if (/^[-*]\s/.test(line)) {
      const content = line.replace(/^[-*]\s/, "");
      return (
        <li key={i} className="ml-4 list-disc">
          <InlineMarkdown text={content} />
        </li>
      );
    }
    // Numbered list
    if (/^\d+\.\s/.test(line)) {
      const content = line.replace(/^\d+\.\s/, "");
      return (
        <li key={i} className="ml-4 list-decimal">
          <InlineMarkdown text={content} />
        </li>
      );
    }
    // Empty line
    if (line.trim() === "") {
      return <br key={i} />;
    }
    return (
      <p key={i}>
        <InlineMarkdown text={line} />
      </p>
    );
  });
}

function InlineMarkdown({ text }: { text: string }) {
  // Handle **bold** and `code`
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={i} className="font-semibold text-zinc-100">
              {part.slice(2, -2)}
            </strong>
          );
        }
        if (part.startsWith("`") && part.endsWith("`")) {
          return (
            <code
              key={i}
              className="px-1 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono text-xs"
            >
              {part.slice(1, -1)}
            </code>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

// ── Suggested Prompts ────────────────────────────────────────────────────────

const SUGGESTED_PROMPTS = [
  "How diversified is my portfolio?",
  "Which positions should I worry about?",
  "How does inflation affect my holdings?",
  "Suggest a rebalancing strategy",
];

// ── Main Component ───────────────────────────────────────────────────────────

export default function ChatPanel() {
  const { data: portfolioRows } = usePortfolioData();
  const { messages, sendMessage, isStreaming, error, clearChat, abortStream } =
    useChatInsights();

  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll on new content
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || isStreaming) return;
    const portfolio = mapRowsToChat(portfolioRows);
    sendMessage(input, portfolio);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestion = (prompt: string) => {
    const portfolio = mapRowsToChat(portfolioRows);
    sendMessage(prompt, portfolio);
  };

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 flex flex-col" style={{ height: "500px" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-blue-400" />
          <h3 className="text-sm font-semibold">Portfolio Chat</h3>
          {messages.length > 0 && (
            <span className="text-[10px] text-zinc-600">{messages.length} messages</span>
          )}
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearChat}
            className="p-1.5 rounded-md hover:bg-zinc-800 transition-colors text-zinc-500 hover:text-zinc-300"
            title="Clear chat"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <Bot className="h-10 w-10 text-zinc-700" />
            <p className="text-sm text-zinc-500 text-center">
              Ask anything about your portfolio, market conditions, or investment strategy.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => handleSuggestion(prompt)}
                  className="text-xs px-3 py-1.5 rounded-full border border-zinc-700 text-zinc-400
                             hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              "flex gap-2",
              msg.role === "user" ? "justify-end" : "justify-start"
            )}
          >
            {msg.role === "assistant" && (
              <div className="h-6 w-6 rounded-full bg-zinc-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Bot className="h-3.5 w-3.5 text-blue-400" />
              </div>
            )}
            <div
              className={cn(
                "max-w-[80%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed",
                msg.role === "user"
                  ? "bg-blue-600/20 text-zinc-200 border border-blue-500/20"
                  : "bg-zinc-800/50 text-zinc-300 border border-zinc-700/50"
              )}
            >
              {msg.role === "assistant" ? (
                <div className="space-y-1 [&>ul]:space-y-0.5 [&>ol]:space-y-0.5">
                  {renderMarkdown(msg.content)}
                  {isStreaming && i === messages.length - 1 && (
                    <span className="inline-block w-1.5 h-4 bg-blue-400 animate-pulse ml-0.5 align-middle" />
                  )}
                </div>
              ) : (
                msg.content
              )}
            </div>
            {msg.role === "user" && (
              <div className="h-6 w-6 rounded-full bg-blue-600/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                <User className="h-3.5 w-3.5 text-blue-400" />
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-2 text-xs text-red-400 bg-red-950/30 border-t border-red-900/30">
          {error}
        </div>
      )}

      {/* Input Bar */}
      <div className="px-4 py-3 border-t border-zinc-800">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your portfolio..."
            disabled={isStreaming}
            className="flex-1 h-9 rounded-lg border border-zinc-700 bg-zinc-800/50 px-3
                       text-sm text-zinc-200 placeholder:text-zinc-600
                       focus:outline-none focus:ring-1 focus:ring-blue-500/50
                       disabled:opacity-50"
          />
          {isStreaming ? (
            <button
              onClick={abortStream}
              className="h-9 w-9 rounded-lg bg-red-600/20 border border-red-500/30
                         text-red-400 flex items-center justify-center hover:bg-red-600/30
                         transition-colors"
              title="Stop generating"
            >
              <Square className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="h-9 w-9 rounded-lg bg-blue-600 hover:bg-blue-500
                         disabled:opacity-50 text-white flex items-center justify-center
                         transition-colors"
              title="Send message"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
