import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const watchlistItems = [
  { symbol: "EUR/USD", direction: "Long", entry: 1.0842, current: 1.0891, target: 1.095, stop: 1.08, notes: "Bullish structure" },
  { symbol: "GBP/JPY", direction: "Long", entry: 189.42, current: 188.9, target: 192.0, stop: 188.0, notes: "Watching for breakout" },
  { symbol: "XAU/USD", direction: "Long", entry: 2020.0, current: 2045.3, target: 2080.0, stop: 2000.0, notes: "Macro play" },
];

const holdingsItems = [
  { symbol: "BTC/USD", direction: "Long-Term", entry: 42000, current: 68500, target: 100000, stop: 35000, notes: "Hodl" },
  { symbol: "SPY", direction: "Long-Term", entry: 440, current: 512, target: 600, stop: 400, notes: "Index ETF" },
];

function WatchlistTable({ items }: { items: typeof watchlistItems }) {
  return (
    <div className="glass-card overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/[0.06] text-muted-foreground text-xs uppercase tracking-wider">
            <th className="p-3 text-left font-medium">Symbol</th>
            <th className="p-3 text-left font-medium">Direction</th>
            <th className="p-3 text-right font-medium">Entry</th>
            <th className="p-3 text-right font-medium">Current</th>
            <th className="p-3 text-right font-medium">Target</th>
            <th className="p-3 text-right font-medium">Stop</th>
            <th className="p-3 text-right font-medium">% from Entry</th>
            <th className="p-3 text-left font-medium">Notes</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const pctFromEntry = ((item.current - item.entry) / item.entry) * 100;
            const isUp = item.current >= item.entry;
            return (
              <tr
                key={item.symbol}
                className={`border-b border-white/[0.04] transition-colors ${
                  isUp ? "hover:bg-profit/[0.03]" : "hover:bg-loss/[0.03]"
                }`}
              >
                <td className="p-3 font-mono font-medium text-foreground">{item.symbol}</td>
                <td className="p-3"><span className="badge-long">{item.direction}</span></td>
                <td className="p-3 text-right font-mono text-foreground">{item.entry}</td>
                <td className={`p-3 text-right font-mono font-medium ${isUp ? "text-profit" : "text-loss"}`}>{item.current}</td>
                <td className="p-3 text-right font-mono text-muted-foreground">{item.target}</td>
                <td className="p-3 text-right font-mono text-muted-foreground">{item.stop}</td>
                <td className={`p-3 text-right font-mono text-xs ${isUp ? "text-profit" : "text-loss"}`}>
                  {isUp ? <ArrowUpRight className="h-3 w-3 inline mr-1" /> : <ArrowDownRight className="h-3 w-3 inline mr-1" />}
                  {pctFromEntry >= 0 ? "+" : ""}{pctFromEntry.toFixed(2)}%
                </td>
                <td className="p-3 text-muted-foreground text-xs">{item.notes}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function Watchlist() {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-foreground">Watchlist</h1>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Add Position
        </Button>
      </div>

      <Tabs defaultValue="active">
        <TabsList className="bg-white/[0.04] border border-white/[0.08]">
          <TabsTrigger value="active" className="data-[state=active]:bg-white/[0.08]">Active Watchlist</TabsTrigger>
          <TabsTrigger value="holdings" className="data-[state=active]:bg-white/[0.08]">Long-Term Holdings</TabsTrigger>
        </TabsList>
        <TabsContent value="active" className="mt-4">
          <WatchlistTable items={watchlistItems} />
        </TabsContent>
        <TabsContent value="holdings" className="mt-4">
          <WatchlistTable items={holdingsItems} />
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
