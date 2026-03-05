import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

const winrateData = [
  { name: "Wins", value: 64 },
  { name: "Losses", value: 36 },
];

const PROFIT_COLOR = "hsl(142, 71%, 45%)";
const LOSS_COLOR = "hsl(0, 84%, 60%)";

const generateCalendarDays = (year: number, month: number) => {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: { day: number; pnl: number; trades: number }[] = [];
  for (let i = 0; i < firstDay; i++) days.push({ day: 0, pnl: 0, trades: 0 });
  for (let d = 1; d <= daysInMonth; d++) {
    const hasTrades = Math.random() > 0.4;
    days.push({ day: d, pnl: hasTrades ? (Math.random() - 0.4) * 500 : 0, trades: hasTrades ? Math.floor(Math.random() * 5) + 1 : 0 });
  }
  return days;
};

const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export default function Overview() {
  const [month, setMonth] = useState(2);
  const [year, setYear] = useState(2026);
  const calendarDays = generateCalendarDays(year, month);
  const monthlyPnl = calendarDays.reduce((sum, d) => sum + d.pnl, 0);

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(year - 1); } else setMonth(month - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(year + 1); } else setMonth(month + 1); };

  return (
    <div className="flex gap-6 flex-col xl:flex-row">
      {/* Left Panel — Stats */}
      <div className="w-full xl:w-80 shrink-0 space-y-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="backdrop-blur-xl bg-black/40 border border-white/[0.1] rounded-2xl p-6">
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Today's PnL</p>
          <div className="flex items-center gap-2">
            <ArrowUpRight className="h-4 w-4 text-profit" />
            <span className="text-2xl font-mono font-medium text-profit">+$245.00</span>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="backdrop-blur-xl bg-black/40 border border-white/[0.1] rounded-2xl p-6">
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Overall PnL</p>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-mono font-medium text-profit">+$3,500.00</span>
            <span className="px-2 py-0.5 rounded-md text-xs font-mono bg-profit/20 text-profit">+35%</span>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="backdrop-blur-xl bg-black/40 border border-white/[0.1] rounded-2xl p-6 space-y-3">
          <p className="text-xs text-muted-foreground uppercase tracking-widest">Statistics</p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><p className="text-muted-foreground text-xs">Avg Win</p><p className="font-mono text-profit">$128.40</p></div>
            <div><p className="text-muted-foreground text-xs">Avg Loss</p><p className="font-mono text-loss">-$76.20</p></div>
            <div><p className="text-muted-foreground text-xs">Avg RR</p><p className="font-mono text-foreground">1.68</p></div>
            <div><p className="text-muted-foreground text-xs">Win Rate</p><p className="font-mono text-foreground">64%</p></div>
            <div><p className="text-muted-foreground text-xs">Wins</p><p className="font-mono text-profit">48</p></div>
            <div><p className="text-muted-foreground text-xs">Losses</p><p className="font-mono text-loss">27</p></div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="backdrop-blur-xl bg-black/40 border border-white/[0.1] rounded-2xl p-6">
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">Win Rate</p>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={winrateData} cx="50%" cy="50%" innerRadius={35} outerRadius={50} dataKey="value" strokeWidth={0}>
                  <Cell fill={PROFIT_COLOR} />
                  <Cell fill={LOSS_COLOR} />
                </Pie>
                <Tooltip contentStyle={{ background: "rgba(0,0,0,0.8)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#fff", fontSize: "12px" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="backdrop-blur-xl bg-black/40 border border-white/[0.1] rounded-2xl p-6 space-y-2">
          {[
            ["Best Trade", "+$412.00", "text-profit"],
            ["Worst Trade", "-$198.50", "text-loss"],
            ["Total Trades", "75", "text-foreground"],
            ["Avg Hold Time", "2h 14m", "text-foreground"],
            ["Most Traded", "EUR/USD", "text-foreground"],
            ["Profit Factor", "2.14", "text-profit"],
          ].map(([label, value, cls]) => (
            <div key={label} className="flex justify-between text-sm">
              <span className="text-muted-foreground">{label}</span>
              <span className={`font-mono ${cls}`}>{value}</span>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Right Panel — Calendar */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="flex-1 min-w-0">
        <div className="backdrop-blur-xl bg-black/40 border border-white/[0.1] rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <Button variant="ghost" size="icon" onClick={prevMonth} className="text-muted-foreground h-7 w-7"><ChevronLeft className="h-4 w-4" /></Button>
            <div className="text-center">
              <p className="font-semibold text-foreground">{monthNames[month]} {year}</p>
              <p className={`text-sm font-mono ${monthlyPnl >= 0 ? "text-profit" : "text-loss"}`}>
                {monthlyPnl >= 0 ? "+" : ""}${Math.abs(monthlyPnl).toFixed(2)}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={nextMonth} className="text-muted-foreground h-7 w-7"><ChevronRight className="h-4 w-4" /></Button>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => (
              <div key={d} className="text-center text-[10px] text-muted-foreground uppercase tracking-wider py-2">{d}</div>
            ))}
            {calendarDays.map((day, i) => (
              <div key={i} className={`aspect-square flex flex-col items-center justify-center rounded-lg text-xs transition-colors ${day.day === 0 ? "" : "hover:bg-white/[0.05] cursor-pointer"}`}>
                {day.day > 0 && (
                  <>
                    <span className="text-muted-foreground text-[10px]">{day.day}</span>
                    {day.trades > 0 && (
                      <>
                        <span className={`font-mono text-[11px] font-medium ${day.pnl >= 0 ? "text-profit" : "text-loss"}`}>
                          {day.pnl >= 0 ? "+" : ""}${Math.abs(day.pnl).toFixed(0)}
                        </span>
                        <span className="text-[9px] text-muted-foreground">{day.trades}t</span>
                      </>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
