import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, RotateCcw } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import ReactMarkdown from "react-markdown";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTED_PROMPTS = [
  "What was my best trading day?",
  "What is my most profitable setup?",
  "Where am I losing the most money?",
  "How much is 1 pip on EUR/USD with 1 lot?",
  "What does my journal say about my worst trades?",
  "Am I improving month over month?",
];

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/momentra-ai`;

async function buildContext(userId: string) {
  // Fetch account
  const { data: accounts } = await supabase
    .from("accounts")
    .select("*")
    .eq("user_id", userId);
  const account = accounts?.[0];

  // Fetch all closed trades
  const { data: trades } = await supabase
    .from("trades")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "closed")
    .order("close_time", { ascending: false });

  // Fetch transactions
  const { data: transactions } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", userId);

  const allTrades = (trades as any[]) || [];
  const allTxns = (transactions as any[]) || [];

  const wins = allTrades.filter((t) => (Number(t.pnl) || 0) > 0);
  const losses = allTrades.filter((t) => (Number(t.pnl) || 0) < 0);
  const sumWins = wins.reduce((s, t) => s + Number(t.pnl), 0);
  const sumLosses = losses.reduce((s, t) => s + Number(t.pnl), 0);
  const totalPnl = allTrades.reduce((s, t) => s + (Number(t.pnl) || 0), 0);
  const totalCommissions = allTrades.reduce((s, t) => s + (Number(t.commissions) || 0), 0);

  // Group by symbol
  const bySymbol: Record<string, { count: number; pnl: number }> = {};
  allTrades.forEach((t) => {
    if (!bySymbol[t.symbol]) bySymbol[t.symbol] = { count: 0, pnl: 0 };
    bySymbol[t.symbol].count++;
    bySymbol[t.symbol].pnl += Number(t.pnl) || 0;
  });

  // Group by tag
  const byTag: Record<string, { count: number; pnl: number }> = {};
  allTrades.forEach((t) => {
    (t.tags || []).forEach((tag: string) => {
      if (!byTag[tag]) byTag[tag] = { count: 0, pnl: 0 };
      byTag[tag].count++;
      byTag[tag].pnl += Number(t.pnl) || 0;
    });
  });

  // Group by day of week
  const byDayOfWeek: Record<string, { count: number; pnl: number }> = {};
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  allTrades.forEach((t) => {
    if (!t.close_time) return;
    const day = dayNames[new Date(t.close_time).getDay()];
    if (!byDayOfWeek[day]) byDayOfWeek[day] = { count: 0, pnl: 0 };
    byDayOfWeek[day].count++;
    byDayOfWeek[day].pnl += Number(t.pnl) || 0;
  });

  // Monthly PnL
  const byMonth: Record<string, { count: number; pnl: number }> = {};
  allTrades.forEach((t) => {
    if (!t.close_time) return;
    const d = new Date(t.close_time);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!byMonth[key]) byMonth[key] = { count: 0, pnl: 0 };
    byMonth[key].count++;
    byMonth[key].pnl += Number(t.pnl) || 0;
  });

  // Best/worst trade
  const bestTrade = allTrades.length
    ? allTrades.reduce((best, t) => (Number(t.pnl) > Number(best.pnl) ? t : best))
    : null;
  const worstTrade = allTrades.length
    ? allTrades.reduce((worst, t) => (Number(t.pnl) < Number(worst.pnl) ? t : worst))
    : null;

  // Win/loss streaks
  let longestWinStreak = 0, longestLossStreak = 0, curWin = 0, curLoss = 0;
  [...allTrades].reverse().forEach((t) => {
    if (Number(t.pnl) > 0) { curWin++; curLoss = 0; longestWinStreak = Math.max(longestWinStreak, curWin); }
    else { curLoss++; curWin = 0; longestLossStreak = Math.max(longestLossStreak, curLoss); }
  });

  // Deposits/Withdrawals
  const sumDeposits = allTxns.filter((t) => t.type === "deposit").reduce((s, t) => s + Number(t.amount), 0);
  const sumWithdrawals = allTxns.filter((t) => t.type === "withdrawal").reduce((s, t) => s + Number(t.amount), 0);

  const mostTradedSymbol = Object.entries(bySymbol).sort((a, b) => b[1].count - a[1].count)[0]?.[0] || "N/A";
  const mostProfitableSymbol = Object.entries(bySymbol).sort((a, b) => b[1].pnl - a[1].pnl)[0]?.[0] || "N/A";

  return {
    account: account ? {
      name: (account as any).name,
      initialBalance: Number((account as any).initial_balance),
      currentBalance: Number((account as any).balance),
      totalDeposits: sumDeposits,
      totalWithdrawals: sumWithdrawals,
      createdAt: (account as any).created_at,
    } : null,
    trades: allTrades.map((t) => ({
      symbol: t.symbol, side: t.side, entry: t.entry_price, exit: t.exit_price,
      qty: t.quantity, tp: t.tp, sl: t.sl, pnl: t.pnl, commissions: t.commissions,
      openTime: t.open_time, closeTime: t.close_time, tags: t.tags, note: t.note,
    })),
    stats: {
      totalTrades: allTrades.length, totalWins: wins.length, totalLosses: losses.length,
      winRate: allTrades.length ? (wins.length / allTrades.length * 100).toFixed(1) + "%" : "0%",
      avgWin: wins.length ? (sumWins / wins.length).toFixed(2) : "0",
      avgLoss: losses.length ? (sumLosses / losses.length).toFixed(2) : "0",
      totalPnl: totalPnl.toFixed(2), totalCommissions: totalCommissions.toFixed(2),
      profitFactor: sumLosses !== 0 ? Math.abs(sumWins / sumLosses).toFixed(2) : "∞",
      mostTradedSymbol, mostProfitableSymbol,
      longestWinStreak, longestLossStreak,
      bestTrade: bestTrade ? { symbol: bestTrade.symbol, pnl: bestTrade.pnl, date: bestTrade.close_time } : null,
      worstTrade: worstTrade ? { symbol: worstTrade.symbol, pnl: worstTrade.pnl, date: worstTrade.close_time } : null,
    },
    bySymbol, byTag, byDayOfWeek, byMonth,
    transactions: allTxns.map((t) => ({ type: t.type, amount: t.amount, date: t.date, note: t.note })),
    today: new Date().toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

function buildSystemPrompt(context: any) {
  return `You are Momentra AI — an elite personal trading coach, journal analyst, and financial educator built into the Momentra trading journal.

You have two modes:

MODE 1 — PERSONAL ANALYST:
The user's complete trading data is provided below. Use it to answer any question about their performance with specific numbers, dates, and patterns. Never guess or make up data — only use what is provided. Be specific: name the exact trade, date, symbol, and PnL when referencing data.

MODE 2 — TRADING EDUCATOR:
For general trading questions not related to their personal data, answer as a professional trading educator with deep knowledge of:
- Forex, Crypto, Commodities, Indices, Stocks
- Technical analysis (price action, ICT concepts, SMC, indicators, chart patterns)
- Risk management (position sizing, lot calculations, pip values, R:R, drawdown)
- Trading psychology (discipline, FOMO, revenge trading, consistency)
- Trading sessions (London, New York, Tokyo, Sydney — open/close times, characteristics)
- Broker mechanics (spreads, commissions, swap rates, margin, leverage)
- Strategies (scalping, swing, breakout, trend following, mean reversion)
- Economics (news events, central banks, inflation, interest rates impact on markets)

CALCULATION ABILITIES:
You can perform live calculations when asked:
- Pip value: (lot size × contract size × pip size) / exchange rate
- Position size: (account risk % × balance) / (SL in pips × pip value)
- Risk/Reward ratio from entry, TP, SL
- Profit/Loss from entry, exit, lots, symbol
- Margin required: (lot size × contract size × price) / leverage
- Break-even price after commissions

PATTERN RECOGNITION:
When analyzing the user's trades, proactively identify:
- Their best and worst performing setups (by tag)
- Time of day they perform best/worst
- Symbols they over/under perform on
- Whether they are improving month over month
- Common mistakes in losing trades

PERSONALITY:
- Encouraging but honest — don't sugarcoat poor performance, but frame it constructively
- Data-driven — always back insights with specific numbers from their data
- Concise — give complete answers without unnecessary padding
- Proactive — if you notice something important in their data while answering, mention it

RESPONSE FORMAT:
- Use short paragraphs, not walls of text
- Use bullet points for lists of insights
- Bold key numbers and findings
- For calculations, show the formula and working
- End analytical responses with one actionable suggestion

USER TRADING DATA:
${JSON.stringify(context, null, 2)}`;
}

export function MomentraAI() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [contextCache, setContextCache] = useState<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // Focus input when opened
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const refreshContext = useCallback(async () => {
    if (!user) return null;
    const ctx = await buildContext(user.id);
    setContextCache(ctx);
    return ctx;
  }, [user]);

  const send = async (text?: string) => {
    const content = text || input.trim();
    if (!content || isLoading || !user) return;
    setInput("");

    const userMsg: Msg = { role: "user", content };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      // Build context on first message or refresh periodically
      let ctx = contextCache;
      if (!ctx) ctx = await refreshContext();

      const systemPrompt = buildSystemPrompt(ctx);

      // Only send last 20 messages to keep payload manageable
      const historyToSend = newMessages.slice(-20);

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: historyToSend, systemPrompt }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Something went wrong");
      }

      if (!resp.body) throw new Error("No response body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let assistantSoFar = "";
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") { streamDone = true; break; }
          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (delta) {
              assistantSoFar += delta;
              const current = assistantSoFar;
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: current } : m);
                }
                return [...prev, { role: "assistant", content: current }];
              });
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Final flush
      if (textBuffer.trim()) {
        for (let raw of textBuffer.split("\n")) {
          if (!raw) continue;
          if (raw.endsWith("\r")) raw = raw.slice(0, -1);
          if (!raw.startsWith("data: ")) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              assistantSoFar += delta;
              const current = assistantSoFar;
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: current } : m);
                }
                return [...prev, { role: "assistant", content: current }];
              });
            }
          } catch { /* ignore */ }
        }
      }
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Something went wrong: ${e.message}. Please try again.` },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setContextCache(null);
  };

  const hasMessages = messages.length > 0;

  return (
    <>
      {/* M Button */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-4 right-4 z-[200] h-12 w-12 rounded-full flex items-center justify-center backdrop-blur-xl bg-black/60 border border-white/[0.15] shadow-[0_0_20px_rgba(99,102,241,0.15)] hover:shadow-[0_0_30px_rgba(99,102,241,0.3)] transition-all duration-300 group"
      >
        <span className="text-lg font-bold bg-gradient-to-br from-blue-400 to-indigo-400 bg-clip-text text-transparent group-hover:from-blue-300 group-hover:to-indigo-300 transition-all">
          M
        </span>
      </button>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="fixed bottom-20 right-4 z-[9999] w-[420px] h-[580px] max-w-[calc(100vw-2rem)] max-h-[calc(100vh-6rem)] backdrop-blur-2xl bg-black/80 border border-white/[0.12] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.08]">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border border-white/[0.15] flex items-center justify-center shadow-[0_0_12px_rgba(99,102,241,0.2)]">
                <span className="text-sm font-bold bg-gradient-to-br from-blue-400 to-indigo-400 bg-clip-text text-transparent">M</span>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-foreground">Momentra AI</h3>
                <p className="text-[10px] text-muted-foreground">Your personal trading coach</p>
              </div>
              {hasMessages && (
                <button onClick={clearChat} className="text-muted-foreground hover:text-foreground transition-colors p-1" title="Clear chat">
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors p-1">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {!hasMessages && !isLoading && (
                <div className="flex flex-col items-center justify-center h-full gap-4">
                  <div className="h-14 w-14 rounded-full bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border border-white/[0.1] flex items-center justify-center shadow-[0_0_24px_rgba(99,102,241,0.15)]">
                    <span className="text-2xl font-bold bg-gradient-to-br from-blue-400 to-indigo-400 bg-clip-text text-transparent">M</span>
                  </div>
                  <p className="text-xs text-muted-foreground text-center max-w-[280px]">
                    Ask me anything about your trading performance, strategies, or general trading knowledge.
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center max-w-[360px]">
                    {SUGGESTED_PROMPTS.map((prompt) => (
                      <button
                        key={prompt}
                        onClick={() => send(prompt)}
                        className="px-3 py-1.5 rounded-full text-[11px] bg-white/[0.05] border border-white/[0.08] text-muted-foreground hover:text-foreground hover:bg-white/[0.08] transition-all"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "assistant" && (
                    <div className="h-6 w-6 rounded-full bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border border-white/[0.1] flex items-center justify-center shrink-0 mt-1 mr-2">
                      <span className="text-[10px] font-bold bg-gradient-to-br from-blue-400 to-indigo-400 bg-clip-text text-transparent">M</span>
                    </div>
                  )}
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                      msg.role === "user"
                        ? "bg-primary/20 text-foreground rounded-br-md"
                        : "bg-white/[0.05] border border-white/[0.06] text-foreground rounded-bl-md"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <div className="prose prose-sm prose-invert max-w-none [&_p]:my-1 [&_ul]:my-1 [&_li]:my-0.5 [&_strong]:text-foreground [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      msg.content
                    )}
                  </div>
                </div>
              ))}

              {/* Typing indicator */}
              {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
                <div className="flex items-start gap-2">
                  <div className="h-6 w-6 rounded-full bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border border-white/[0.1] flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold bg-gradient-to-br from-blue-400 to-indigo-400 bg-clip-text text-transparent">M</span>
                  </div>
                  <div className="bg-white/[0.05] border border-white/[0.06] rounded-2xl rounded-bl-md px-4 py-3">
                    <div className="flex gap-1">
                      <span className="h-2 w-2 rounded-full bg-muted-foreground animate-pulse" style={{ animationDelay: "0ms" }} />
                      <span className="h-2 w-2 rounded-full bg-muted-foreground animate-pulse" style={{ animationDelay: "150ms" }} />
                      <span className="h-2 w-2 rounded-full bg-muted-foreground animate-pulse" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="px-4 py-3 border-t border-white/[0.08]">
              <form
                onSubmit={(e) => { e.preventDefault(); send(); }}
                className="flex items-center gap-2"
              >
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask Momentra anything..."
                  className="flex-1 bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="h-10 w-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary hover:bg-primary/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
