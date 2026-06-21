"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Sparkles, X, Send, Shield, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "What should I fix first and why?",
  "Summarize my current risk posture",
  "Which internet-exposed assets are most at risk?",
  "Explain my top alert in plain English",
];

const PANEL_BG = "oklch(0.175 0.004 286)";
const PANEL_BORDER = "1px solid oklch(1 0 0 / 8%)";

export function AskCrisp() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    });
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Allow other surfaces (e.g. the ⌘K command palette) to open the assistant.
  useEffect(() => {
    function onAsk() { setOpen(true); }
    window.addEventListener("crisp:ask", onAsk);
    return () => window.removeEventListener("crisp:ask", onAsk);
  }, []);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || streaming) return;

      const next: Msg[] = [...messages, { role: "user", content: trimmed }];
      setMessages([...next, { role: "assistant", content: "" }]);
      setInput("");
      setStreaming(true);
      scrollToBottom();

      try {
        const res = await fetch("/api/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: next }),
        });

        if (!res.ok || !res.body) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Request failed");
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let acc = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          acc += decoder.decode(value, { stream: true });
          setMessages((prev) => {
            const copy = [...prev];
            copy[copy.length - 1] = { role: "assistant", content: acc };
            return copy;
          });
          scrollToBottom();
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Something went wrong.";
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: "assistant", content: `_Error: ${msg}_` };
          return copy;
        });
      } finally {
        setStreaming(false);
        scrollToBottom();
      }
    },
    [messages, streaming, scrollToBottom]
  );

  return (
    <>
      {/* Launcher */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-50 flex items-center gap-2 h-12 px-4 rounded-full shadow-lg text-sm font-semibold text-primary-foreground transition-transform hover:scale-105 active:scale-95"
          style={{ background: "oklch(0.70 0.15 162)" }}
          aria-label="Open CRISP AI Analyst"
        >
          <Sparkles className="w-4 h-4" />
          Ask CRISP
        </button>
      )}

      {/* Panel */}
      {open && (
        <div
          className="fixed z-50 flex flex-col bottom-0 right-0 w-full sm:bottom-5 sm:right-5 sm:w-[400px] h-[85vh] sm:h-[600px] sm:max-h-[85vh] sm:rounded-2xl overflow-hidden shadow-2xl"
          style={{ background: PANEL_BG, border: PANEL_BORDER }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 flex-shrink-0"
            style={{ borderBottom: "1px solid oklch(1 0 0 / 6%)" }}
          >
            <div className="flex items-center gap-2.5">
              <div
                className="flex items-center justify-center w-8 h-8 rounded-lg"
                style={{ background: "oklch(0.70 0.15 162 / 15%)", border: "1px solid oklch(0.70 0.15 162 / 30%)" }}
              >
                <Sparkles className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-bold leading-tight">CRISP Analyst</p>
                <p className="text-[10px] text-muted-foreground leading-tight">
                  AI advisor · grounded in your live data
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  onClick={() => setMessages([])}
                  className="text-[11px] text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-white/5"
                >
                  Clear
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1.5 rounded-md hover:bg-white/5"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-2">
                <div
                  className="flex items-center justify-center w-12 h-12 rounded-2xl mb-3"
                  style={{ background: "oklch(0.70 0.15 162 / 12%)", border: "1px solid oklch(0.70 0.15 162 / 25%)" }}
                >
                  <Shield className="w-6 h-6 text-primary" />
                </div>
                <p className="text-sm font-semibold mb-1">Ask about your risk posture</p>
                <p className="text-xs text-muted-foreground mb-4 max-w-[260px]">
                  I read your live assets, CVEs, alerts, and controls to answer.
                </p>
                <div className="flex flex-col gap-2 w-full">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="text-left text-xs px-3 py-2 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                      style={{ background: "oklch(0.205 0.004 286)", border: "1px solid oklch(1 0 0 / 6%)" }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m, i) => <Bubble key={i} msg={m} streaming={streaming && i === messages.length - 1} />)
            )}
          </div>

          {/* Composer */}
          <div className="px-3 py-3 flex-shrink-0" style={{ borderTop: "1px solid oklch(1 0 0 / 6%)" }}>
            <div
              className="flex items-end gap-2 rounded-xl px-3 py-2"
              style={{ background: "oklch(0.205 0.004 286)", border: "1px solid oklch(1 0 0 / 8%)" }}
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                rows={1}
                placeholder="Ask about CVEs, assets, what to fix first…"
                className="flex-1 bg-transparent resize-none outline-none text-sm placeholder:text-muted-foreground max-h-28 py-1"
                disabled={streaming}
              />
              <Button
                size="sm"
                className="h-8 w-8 p-0 flex-shrink-0"
                onClick={() => send(input)}
                disabled={streaming || !input.trim()}
              >
                {streaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground text-center mt-1.5">
              Grounded in your live CRISP data
            </p>
          </div>
        </div>
      )}
    </>
  );
}

function Bubble({ msg, streaming }: { msg: Msg; streaming: boolean }) {
  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div
          className="max-w-[85%] rounded-2xl rounded-br-sm px-3.5 py-2 text-sm"
          style={{ background: "oklch(0.70 0.15 162 / 18%)", border: "1px solid oklch(0.70 0.15 162 / 30%)" }}
        >
          {msg.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[90%] text-sm leading-relaxed">
        {msg.content === "" && streaming ? (
          <span className="inline-flex items-center gap-2 text-muted-foreground text-xs">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Analyzing your posture…
          </span>
        ) : (
          <Markdown text={msg.content} />
        )}
      </div>
    </div>
  );
}

// Minimal markdown renderer — handles headers, bold, and bullet lists, which is
// all the model is instructed to emit. Keeps the bundle free of a md dependency.
function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1.5">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} className="h-1" />;

        if (trimmed.startsWith("### ")) {
          return <p key={i} className="font-bold text-foreground mt-2">{inline(trimmed.slice(4))}</p>;
        }
        if (trimmed.startsWith("## ")) {
          return <p key={i} className="font-bold text-foreground text-[15px] mt-2">{inline(trimmed.slice(3))}</p>;
        }
        if (/^[-*]\s/.test(trimmed)) {
          return (
            <div key={i} className="flex gap-2 pl-1">
              <span className="text-primary mt-0.5 flex-shrink-0">•</span>
              <span>{inline(trimmed.replace(/^[-*]\s/, ""))}</span>
            </div>
          );
        }
        const numbered = trimmed.match(/^(\d+)\.\s(.*)/);
        if (numbered) {
          return (
            <div key={i} className="flex gap-2 pl-1">
              <span className="text-primary font-semibold flex-shrink-0">{numbered[1]}.</span>
              <span>{inline(numbered[2])}</span>
            </div>
          );
        }
        return <p key={i}>{inline(trimmed)}</p>;
      })}
    </div>
  );
}

// Renders inline **bold**, `code`, and _italic_ spans.
function inline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|_[^_]+_)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={i} className="font-mono text-[12px] px-1 py-0.5 rounded" style={{ background: "oklch(0.235 0.005 286)" }}>
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("_") && part.endsWith("_")) {
      return <em key={i} className="italic text-muted-foreground">{part.slice(1, -1)}</em>;
    }
    return part;
  });
}
