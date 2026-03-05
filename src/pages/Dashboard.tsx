import { useState } from "react";
import { motion } from "framer-motion";
import {
  Plus,
  Upload,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  Pin,
  Flame,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { TradeImportModal } from "@/components/TradeImportModal";

const balanceHistory = [
  { date: "Jan", balance: 10000 },
  { date: "Feb", balance: 10450 },
  { date: "Mar", balance: 10200 },
  { date: "Apr", balance: 11300 },
  { date: "May", balance: 11100 },
  { date: "Jun", balance: 12400 },
  { date: "Jul", balance: 12800 },
  { date: "Aug", balance: 13500 },
];

const openPositions: any[] = [];

const closedPositions = [
  {
    id: "1",
    tags: ["Scalp"],
    alias: "Morning Dip",
    closedAt: "2026-03-04 14:32",
    symbol: "EUR/USD",
    side: "Long",
    qty: 1.5,
    entry: 1.0842,
    exit: 1.0891,
    pnl: 73.5,
    session: "London",
  },
  {
    id: "2",
    tags: ["Swing"],
    alias: "Gold Short",
    closedAt: "2026-03-03 19:15",
    symbol: "XAU/USD",
    side: "Short",
    qty: 0.5,
    entry: 2045.3,
    exit: 2058.1,
    pnl: -64.0,
    session: "New York",
  },
  {
    id: "3",
    tags: ["Breakout"],
    alias: "",
    closedAt: "2026-03-02 03:45",
    symbol: "GBP/JPY",
    side: "Long",
    qty: 2.0,
    entry: 189.42,
    exit: 190.18,
    pnl: 152.0,
    session: "Tokyo",
  },
];

const streakDays = [true, true, true, false, true, true, false];
const dayLabels = ["M", "T", "W", "T", "F", "S", "S"];

export default function Dashboard() {
  const [importOpen, setImportOpen] = useState(false);

  return (
    <div className="flex gap-6 flex-col xl:flex-row">
      {/* Left Panel */}
      <div className="w-full xl:w-80 shrink-0 space-y-4">
        <Select defaultValue="main">
          <SelectTrigger className="glass-card border-white/[0.08] bg-white/[0.04]">
            <SelectValue placeholder="Select account" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="main">Main Account</SelectItem>
            <SelectItem value="demo">Demo Account</SelectItem>
          </SelectContent>
        </Select>

        <div className="space-y-2">
          <Button
            variant="outline"
            className="w-full justify-start gap-2 glass-card border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.07] text-foreground"
            onClick={() => setImportOpen(true)}
          >
            <Plus className="h-4 w-4" /> Manual Trade Import
          </Button>
          <Button variant="outline" className="w-full justify-start gap-2 glass-card border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.07] text-foreground">
            <Upload className="h-4 w-4" /> CSV / AI Import
          </Button>
          <Button variant="outline" className="w-full justify-start gap-2 glass-card border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.07] text-foreground">
            <RefreshCw className="h-4 w-4" /> Sync with Broker
          </Button>
        </div>

        {/* Balance Card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-5"
        >
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">
            Total Balance
          </p>
          <p className="text-3xl font-mono font-medium text-foreground">
            $13,500.00
          </p>
          <div className="flex items-center gap-2 mt-1">
            <ArrowUpRight className="h-3.5 w-3.5 text-profit" />
            <span className="text-sm font-mono text-profit">+$245.00 today</span>
          </div>
          <div className="mt-4 h-24">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={balanceHistory}>
                <Line
                  type="monotone"
                  dataKey="balance"
                  stroke="hsl(217, 91%, 60%)"
                  strokeWidth={2}
                  dot={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(150, 8%, 8%)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "8px",
                    color: "#fff",
                    fontFamily: "DM Mono",
                    fontSize: "12px",
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <Button variant="outline" size="sm" className="w-full mt-3 glass-card border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.07] text-foreground text-xs">
            Deposit / Withdraw
          </Button>
        </motion.div>

        {/* Streak Tracker */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card p-5"
        >
          <div className="flex items-center gap-2 mb-3">
            <Flame className="h-5 w-5 text-orange-400" />
            <span className="font-semibold text-foreground">5 day streak</span>
            <span className="text-xs text-muted-foreground ml-auto">Best: 12</span>
          </div>
          <div className="flex gap-2 justify-between">
            {dayLabels.map((d, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <span className="text-[10px] text-muted-foreground">{d}</span>
                <div
                  className={`h-3 w-3 rounded-full ${
                    streakDays[i]
                      ? "bg-profit"
                      : "bg-white/[0.08]"
                  } ${i === 5 ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : ""}`}
                />
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Main Panel */}
      <div className="flex-1 space-y-6 min-w-0">
        {/* Open Positions */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
              Open Orders & Positions
            </h2>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">
              <Filter className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="glass-card overflow-hidden">
            {openPositions.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground text-sm">
                No orders to display. Create your first order.
              </div>
            ) : null}
          </div>
        </motion.div>

        {/* Closed Positions */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
              Closed Positions
            </h2>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">
              <Filter className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="glass-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-muted-foreground text-xs uppercase tracking-wider">
                  <th className="p-3 text-left font-medium">
                    <Pin className="h-3 w-3" />
                  </th>
                  <th className="p-3 text-left font-medium">Tags</th>
                  <th className="p-3 text-left font-medium">Alias</th>
                  <th className="p-3 text-left font-medium">Closed At</th>
                  <th className="p-3 text-left font-medium">Symbol</th>
                  <th className="p-3 text-left font-medium">Side</th>
                  <th className="p-3 text-right font-medium">Qty</th>
                  <th className="p-3 text-right font-medium">Entry</th>
                  <th className="p-3 text-right font-medium">Exit</th>
                  <th className="p-3 text-right font-medium">PnL</th>
                  <th className="p-3 text-left font-medium">Session</th>
                </tr>
              </thead>
              <tbody>
                {closedPositions.map((pos) => (
                  <tr
                    key={pos.id}
                    className="border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors"
                  >
                    <td className="p-3">
                      <Pin className="h-3 w-3 text-muted-foreground cursor-pointer hover:text-foreground" />
                    </td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        {pos.tags.map((t) => (
                          <span
                            key={t}
                            className="px-1.5 py-0.5 rounded text-[10px] bg-white/[0.06] text-muted-foreground"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="p-3 text-foreground">{pos.alias || "—"}</td>
                    <td className="p-3 font-mono text-xs text-muted-foreground">
                      {pos.closedAt}
                    </td>
                    <td className="p-3 font-mono font-medium text-foreground">
                      {pos.symbol}
                    </td>
                    <td className="p-3">
                      <span className={pos.side === "Long" ? "badge-long" : "badge-short"}>
                        {pos.side}
                      </span>
                    </td>
                    <td className="p-3 text-right font-mono text-foreground">
                      {pos.qty}
                    </td>
                    <td className="p-3 text-right font-mono text-foreground">
                      {pos.entry}
                    </td>
                    <td className="p-3 text-right font-mono text-foreground">
                      {pos.exit}
                    </td>
                    <td
                      className={`p-3 text-right font-mono font-medium ${
                        pos.pnl >= 0 ? "text-profit" : "text-loss"
                      }`}
                    >
                      {pos.pnl >= 0 ? "+" : ""}
                      ${Math.abs(pos.pnl).toFixed(2)}
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {pos.session}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>

      <TradeImportModal open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}
