import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Plus,
  Upload,
  RefreshCw,
  ArrowUpRight,
  Filter,
  Pin,
  Settings2,
} from "lucide-react";
import { AnimatedFlame } from "@/components/AnimatedFlame";
import { useStreak } from "@/hooks/useStreak";
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
import { CSVImportModal } from "@/components/CSVImportModal";
import { ManageAccountsModal, type Account } from "@/components/ManageAccountsModal";
import { DepositWithdrawModal, type Transaction } from "@/components/DepositWithdrawModal";
import {
  ClosedPositionsFilter,
  hasActiveFilters,
  applyFilters,
  type ClosedPositionFilters,
} from "@/components/ClosedPositionsFilter";

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
  { id: "1", tags: ["Scalp"], alias: "Morning Dip", closedAt: "2026-03-04 14:32", symbol: "EUR/USD", side: "Long", qty: 1.5, entry: 1.0842, exit: 1.0891, pnl: 73.5, session: "London", hasNote: true },
  { id: "2", tags: ["Swing"], alias: "Gold Short", closedAt: "2026-03-03 19:15", symbol: "XAU/USD", side: "Short", qty: 0.5, entry: 2045.3, exit: 2058.1, pnl: -64.0, session: "New York", hasNote: false },
  { id: "3", tags: ["Breakout"], alias: "", closedAt: "2026-03-02 03:45", symbol: "GBP/JPY", side: "Long", qty: 2.0, entry: 189.42, exit: 190.18, pnl: 152.0, session: "Tokyo", hasNote: true },
];

const dayLabels = ["M", "T", "W", "T", "F", "S", "S"];

const defaultAccounts: Account[] = [
  { id: "1", name: "Main Account", balance: 13500 },
  { id: "2", name: "Demo Account", balance: 10000 },
];

const emptyFilters: ClosedPositionFilters = {
  dateFrom: undefined,
  dateTo: undefined,
  symbol: "",
  direction: "all",
};

export default function Dashboard() {
  const [importOpen, setImportOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  const [accounts, setAccounts] = useState<Account[]>(defaultAccounts);
  const [selectedAccountId, setSelectedAccountId] = useState(defaultAccounts[0].id);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filters, setFilters] = useState<ClosedPositionFilters>(emptyFilters);

  const { currentStreak, bestStreak, getWeekDots, loading: streakLoading } = useStreak();
  const streakDays = getWeekDots();

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId) ?? accounts[0];

  const handleTransaction = (tx: Omit<Transaction, "id">) => {
    const newTx: Transaction = { ...tx, id: crypto.randomUUID() };
    setTransactions((prev) => [newTx, ...prev]);
    // Update balance
    setAccounts((prev) =>
      prev.map((acc) =>
        acc.id === selectedAccountId
          ? {
              ...acc,
              balance:
                tx.type === "deposit"
                  ? acc.balance + tx.amount
                  : acc.balance - tx.amount,
            }
          : acc
      )
    );
  };

  const uniqueSymbols = useMemo(
    () => [...new Set(closedPositions.map((p) => p.symbol))],
    []
  );

  const filteredPositions = useMemo(
    () => applyFilters(closedPositions, filters),
    [filters]
  );

  const filtersActive = hasActiveFilters(filters);

  return (
    <div className="flex gap-6 flex-col xl:flex-row">
      {/* Left Panel */}
      <div className="w-full xl:w-80 shrink-0 space-y-4">
        {/* Streak Tracker Card — TOP */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="backdrop-blur-xl bg-black/40 border border-white/[0.1] rounded-2xl p-6"
        >
          <div className="flex items-center gap-2 mb-3">
            <AnimatedFlame active={currentStreak >= 1} size={32} />
            <span className="font-semibold text-foreground">
              {streakLoading ? "…" : `${currentStreak} day streak`}
            </span>
            <span className="text-xs text-muted-foreground ml-auto">Best: {bestStreak}</span>
          </div>
          <div className="flex gap-2 justify-between">
            {dayLabels.map((d, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <span className="text-[10px] text-muted-foreground">{d}</span>
                <div
                  className={`h-3 w-3 rounded-full ${
                    streakDays[i] ? "bg-profit" : "bg-white/[0.08]"
                  } ${
                    i === 5
                      ? "ring-2 ring-primary ring-offset-1 ring-offset-background"
                      : ""
                  }`}
                />
              </div>
            ))}
          </div>
        </motion.div>

        {/* Combined Account + Actions Card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.03 }}
          className="backdrop-blur-xl bg-black/40 border border-white/[0.1] rounded-2xl p-6 space-y-3"
        >
          {/* Row 1: Account selector + gear */}
          <div className="flex items-center gap-2">
            <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
              <SelectTrigger className="flex-1 bg-white/[0.04] border-white/[0.08]">
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>
                    {acc.name || "Unnamed Account"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground hover:bg-white/[0.05]"
              onClick={() => setManageOpen(true)}
            >
              <Settings2 className="h-4 w-4" />
            </Button>
          </div>

          {/* Row 2: Manual + CSV side by side */}
          <div className="flex gap-2">
            <Button
              className="flex-1 gap-2 text-xs"
              onClick={() => setImportOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" /> Manual Import
            </Button>
            <Button
              variant="outline"
              className="flex-1 gap-2 text-xs bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.07] text-foreground"
              onClick={() => setCsvOpen(true)}
            >
              <Upload className="h-3.5 w-3.5" /> CSV / AI
            </Button>
          </div>

          {/* Row 3: Sync */}
          <Button
            variant="outline"
            className="w-full gap-2 text-xs bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.07] text-foreground"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Sync with Broker
          </Button>
        </motion.div>

        {/* Balance Card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
          className="backdrop-blur-xl bg-black/40 border border-white/[0.1] rounded-2xl p-6"
        >
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">
            Total Balance
          </p>
          <p className="text-3xl font-mono font-medium text-foreground">
            ${selectedAccount.balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
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
                    background: "rgba(0,0,0,0.8)",
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
          <Button
            variant="outline"
            size="sm"
            className="w-full mt-3 bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.07] text-foreground text-xs"
            onClick={() => setDepositOpen(true)}
          >
            Deposit / Withdraw
          </Button>
        </motion.div>

        {/* Streak Tracker Card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.09 }}
          className="backdrop-blur-xl bg-black/40 border border-white/[0.1] rounded-2xl p-6"
        >
          <div className="flex items-center gap-2 mb-3">
            <AnimatedFlame active={currentStreak >= 1} size={32} />
            <span className="font-semibold text-foreground">
              {streakLoading ? "…" : `${currentStreak} day streak`}
            </span>
            <span className="text-xs text-muted-foreground ml-auto">Best: {bestStreak}</span>
          </div>
          <div className="flex gap-2 justify-between">
            {dayLabels.map((d, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <span className="text-[10px] text-muted-foreground">{d}</span>
                <div
                  className={`h-3 w-3 rounded-full ${
                    streakDays[i] ? "bg-profit" : "bg-white/[0.08]"
                  } ${
                    i === 5
                      ? "ring-2 ring-primary ring-offset-1 ring-offset-background"
                      : ""
                  }`}
                />
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Main Panel */}
      <div className="flex-1 space-y-6 min-w-0">
        {/* Open Positions Card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="backdrop-blur-xl bg-black/40 border border-white/[0.1] rounded-2xl p-6"
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
              Open Orders & Positions
            </h2>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">
              <Filter className="h-3.5 w-3.5" />
            </Button>
          </div>
          {openPositions.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              No orders to display. Create your first order.
            </div>
          ) : null}
        </motion.div>

        {/* Closed Positions Card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="backdrop-blur-xl bg-black/40 border border-white/[0.1] rounded-2xl p-6"
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
              Closed Positions
            </h2>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground relative"
              onClick={() => setFilterOpen(!filterOpen)}
            >
              <Filter className="h-3.5 w-3.5" />
              {filtersActive && (
                <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary" />
              )}
            </Button>
          </div>

          <ClosedPositionsFilter
            open={filterOpen}
            onClose={() => setFilterOpen(false)}
            filters={filters}
            onApply={setFilters}
            symbols={uniqueSymbols}
          />

          <div className="overflow-x-auto -mx-6 px-6">
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
                  <th className="p-3 text-right font-medium">Risk %</th>
                  <th className="p-3 text-right font-medium">PnL</th>
                  <th className="p-3 text-left font-medium">Session</th>
                  <th className="p-3 text-center font-medium">📓</th>
                </tr>
              </thead>
              <tbody>
                {filteredPositions.map((pos) => (
                  <tr
                    key={pos.id}
                    className="border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors"
                  >
                    <td className="p-3">
                      <Pin className="h-3 w-3 text-muted-foreground cursor-pointer hover:text-foreground" />
                    </td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        {pos.tags.map((t: string) => (
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
                    <td className="p-3 text-right font-mono text-foreground">{pos.qty}</td>
                    <td className="p-3 text-right font-mono text-foreground">{pos.entry}</td>
                    <td className="p-3 text-right font-mono text-foreground">{pos.exit}</td>
                    <td className="p-3 text-right font-mono text-muted-foreground">—</td>
                    <td
                      className={`p-3 text-right font-mono font-medium ${
                        pos.pnl >= 0 ? "text-profit" : "text-loss"
                      }`}
                    >
                      {pos.pnl >= 0 ? "+" : ""}${Math.abs(pos.pnl).toFixed(2)}
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">{pos.session}</td>
                    <td className="p-3 text-center">
                      {pos.hasNote && (
                        <span className="cursor-pointer hover:opacity-80" title="View linked note">
                          📓
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredPositions.length === 0 && (
                  <tr>
                    <td colSpan={13} className="p-6 text-center text-muted-foreground text-sm">
                      No positions match your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>

      <TradeImportModal open={importOpen} onOpenChange={setImportOpen} />
      <CSVImportModal open={csvOpen} onOpenChange={setCsvOpen} />
      <ManageAccountsModal
        open={manageOpen}
        onOpenChange={setManageOpen}
        accounts={accounts}
        onAccountsChange={setAccounts}
      />
      <DepositWithdrawModal
        open={depositOpen}
        onOpenChange={setDepositOpen}
        transactions={transactions}
        onConfirm={handleTransaction}
      />
    </div>
  );
}
