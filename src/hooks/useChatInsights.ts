"use client";

import { useState, useCallback, useRef } from "react";
import type { PortfolioAsset } from "@/types/portfolio";

// Re-export for consumers
export type { PortfolioAsset } from "@/types/portfolio";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function useChatInsights() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (content: string, portfolio: PortfolioAsset[]) => {
      if (!content.trim() || isStreaming) return;

      setError(null);

      // Add user message
      const userMsg: ChatMessage = { role: "user", content: content.trim() };
      const updatedMessages = [...messages, userMsg];
      setMessages(updatedMessages);

      // Start streaming
      setIsStreaming(true);
      const controller = new AbortController();
      abortControllerRef.current = controller;

      // Add empty assistant message that will be filled
      const assistantMsg: ChatMessage = { role: "assistant", content: "" };
      setMessages([...updatedMessages, assistantMsg]);

      try {
        const res = await fetch("/api/insights/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: updatedMessages,
            portfolio,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `Chat failed (${res.status})`);
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response stream");

        const decoder = new TextDecoder();
        let accumulatedText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();

            if (data === "[DONE]") break;

            try {
              const parsed = JSON.parse(data);
              if (parsed.error) {
                throw new Error(parsed.error);
              }
              if (parsed.text) {
                accumulatedText += parsed.text;
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    role: "assistant",
                    content: accumulatedText,
                  };
                  return updated;
                });
              }
            } catch (e) {
              // Skip unparseable lines (partial chunks)
              if (e instanceof Error && e.message !== "Unexpected end of JSON input") {
                console.warn("[chat] Parse error:", e);
              }
            }
          }
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          // User cancelled — keep accumulated text
          return;
        }
        const msg = err instanceof Error ? err.message : "Chat failed";
        setError(msg);
        // Remove the empty assistant message on error
        setMessages((prev) => {
          if (prev.length > 0 && prev[prev.length - 1].content === "") {
            return prev.slice(0, -1);
          }
          return prev;
        });
      } finally {
        setIsStreaming(false);
        abortControllerRef.current = null;
      }
    },
    [messages, isStreaming]
  );

  const abortStream = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const clearChat = useCallback(() => {
    abortStream();
    setMessages([]);
    setError(null);
  }, [abortStream]);

  return {
    messages,
    sendMessage,
    isStreaming,
    error,
    clearChat,
    abortStream,
  };
}
