import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronRight, Clock, BookOpen } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

interface LearningCard {
  title: string;
  desc: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  readTime: string;
  content: string;
}

const learningData: Record<string, LearningCard[]> = {
  Fundamentals: [
    { title: "What is a Pip?", desc: "The smallest price move in forex trading.", difficulty: "Beginner", readTime: "3 min", content: "A pip stands for 'percentage in point' or 'price interest point.' It is the smallest price move that a given exchange rate makes based on market convention. For most currency pairs, a pip is 0.0001 (1/10,000th of a unit). For pairs involving JPY, a pip is 0.01. For example, if EUR/USD moves from 1.1050 to 1.1051, that's a one-pip move. Understanding pips is fundamental because they are used to calculate profits, losses, and spread costs." },
    { title: "Lot Sizes Explained", desc: "Standard, mini, and micro lots demystified.", difficulty: "Beginner", readTime: "4 min", content: "In forex trading, a lot refers to the number of currency units you buy or sell. A standard lot is 100,000 units of the base currency. A mini lot is 10,000 units. A micro lot is 1,000 units. For example, if you buy 1 standard lot of EUR/USD, you're buying 100,000 euros. Your lot size directly impacts your profit/loss per pip: Standard lot = ~$10/pip, Mini lot = ~$1/pip, Micro lot = ~$0.10/pip." },
    { title: "How Leverage Works", desc: "Amplify gains and risks with leverage.", difficulty: "Beginner", readTime: "5 min", content: "Leverage allows you to control a large position with a relatively small amount of capital. If your broker offers 100:1 leverage, you can control $100,000 with just $1,000 of margin. While leverage amplifies profits, it equally amplifies losses. A 1% move against your 100:1 leveraged position means you've lost your entire margin. The key is to use leverage responsibly — most professional traders use 10:1 or less." },
    { title: "Understanding Margin Calls", desc: "What happens when your account runs low.", difficulty: "Beginner", readTime: "4 min", content: "A margin call occurs when your account equity falls below the required margin level. When this happens, your broker will either ask you to deposit more funds or automatically close your positions to prevent further losses. Most brokers have a margin call level (e.g., 100%) and a stop-out level (e.g., 50%). To avoid margin calls: use proper position sizing, set stop losses, and never over-leverage." },
    { title: "Bid/Ask Spread", desc: "The cost of every trade you make.", difficulty: "Beginner", readTime: "3 min", content: "The bid price is what buyers are willing to pay, and the ask price is what sellers want. The difference between them is the spread — your transaction cost. Major pairs like EUR/USD have tight spreads (0.1-1 pip), while exotic pairs can have spreads of 5-20 pips. Spreads widen during low liquidity (e.g., market open/close) and during major news events." },
  ],
  "Technical Analysis": [
    { title: "Candlestick Patterns", desc: "Reading Doji, Engulfing, and Hammer patterns.", difficulty: "Intermediate", readTime: "8 min", content: "Candlestick patterns are visual representations of price action. A Doji has equal open and close prices, signaling indecision. A Bullish Engulfing occurs when a green candle completely engulfs the previous red candle, suggesting a reversal. A Hammer has a small body with a long lower wick, typically found at the bottom of downtrends, indicating potential reversal. These patterns are most reliable on higher timeframes (4H, Daily)." },
    { title: "Support & Resistance", desc: "Key price levels where markets react.", difficulty: "Intermediate", readTime: "6 min", content: "Support is a price level where buying pressure prevents further decline. Resistance is where selling pressure prevents further advance. These levels form because traders remember significant price points and act accordingly. When support breaks, it often becomes resistance and vice versa. Identify these levels by looking for areas where price has bounced multiple times. The more touches, the stronger the level." },
    { title: "Moving Averages: SMA vs EMA", desc: "Smoothing price data to identify trends.", difficulty: "Intermediate", readTime: "5 min", content: "Simple Moving Average (SMA) calculates the average price over N periods equally. Exponential Moving Average (EMA) gives more weight to recent prices, making it more responsive. Common settings: 20 EMA for short-term trends, 50 SMA for medium-term, 200 SMA for long-term. Golden Cross (50 crossing above 200) is bullish; Death Cross (50 crossing below 200) is bearish." },
    { title: "RSI Explained", desc: "Measuring momentum and overbought/oversold conditions.", difficulty: "Intermediate", readTime: "5 min", content: "The Relative Strength Index (RSI) measures the speed and magnitude of price changes on a scale of 0-100. Readings above 70 are considered overbought (potential sell signal), while readings below 30 are oversold (potential buy signal). However, in strong trends, RSI can remain overbought/oversold for extended periods. Look for RSI divergence — when price makes new highs but RSI doesn't — as a stronger reversal signal." },
    { title: "Fibonacci Retracements", desc: "Using golden ratios to find trade entries.", difficulty: "Advanced", readTime: "7 min", content: "Fibonacci retracements use horizontal lines at key ratios (23.6%, 38.2%, 50%, 61.8%, 78.6%) to identify potential support/resistance levels during a pullback. Draw from swing low to swing high (uptrend) or swing high to swing low (downtrend). The 61.8% level (golden ratio) is the most watched. Combine with other confluences like support/resistance or candlestick patterns for higher probability setups." },
  ],
  "Risk Management": [
    { title: "The 1% Rule", desc: "Never risk more than 1% per trade.", difficulty: "Beginner", readTime: "4 min", content: "The 1% rule states that you should never risk more than 1% of your total account balance on a single trade. With a $10,000 account, your maximum risk per trade is $100. This means even a string of 10 consecutive losses would only cost you 10% of your account. This rule is the foundation of long-term survival in trading. Some traders use 0.5% for extra safety during drawdowns." },
    { title: "Position Sizing Formula", desc: "Calculate the perfect lot size for every trade.", difficulty: "Intermediate", readTime: "5 min", content: "Position Size = (Account Risk × Account Balance) ÷ (Stop Loss in Pips × Pip Value). Example: $10,000 account, 1% risk ($100), 50 pip stop loss, $10/pip for standard lot. Position size = $100 ÷ (50 × $10) = 0.2 lots. Always calculate position size BEFORE entering a trade. Never adjust your stop loss to fit a desired position size — that's backwards." },
    { title: "Risk/Reward Ratio", desc: "Why 1:2 RR changes everything.", difficulty: "Beginner", readTime: "4 min", content: "Risk/Reward ratio compares your potential loss to your potential gain. A 1:2 RR means you risk $1 to potentially make $2. With a 1:2 RR, you only need to win 34% of your trades to break even. With a 1:3 RR, you only need 25% win rate. Always aim for minimum 1:2 RR. Calculate it before entering: if your stop loss is 30 pips, your take profit should be at least 60 pips." },
    { title: "Setting Stop Losses Correctly", desc: "Place stops at logical levels, not arbitrary distances.", difficulty: "Intermediate", readTime: "6 min", content: "Stop losses should be placed at a level where your trade idea is invalidated — behind support/resistance, above/below a swing high/low, or beyond a key moving average. Never set a stop loss based on a dollar amount you're willing to lose. Instead, determine the correct stop loss level first, then calculate position size accordingly. Give your trades enough room to breathe without being reckless." },
    { title: "Max Daily Drawdown Rules", desc: "Know when to stop trading for the day.", difficulty: "Intermediate", readTime: "4 min", content: "Set a maximum daily loss limit (e.g., 3% of account). Once hit, stop trading for the day — no exceptions. This prevents revenge trading and emotional spirals. Also set a weekly limit (e.g., 6%). If you hit 2 consecutive losing days, consider taking the next day off to reset mentally. The best traders know that protecting capital is more important than making money." },
  ],
  Psychology: [
    { title: "Trading Discipline", desc: "Why your mindset matters more than your strategy.", difficulty: "Beginner", readTime: "5 min", content: "Discipline is the bridge between your trading plan and your results. It means following your rules even when emotions scream otherwise. Key disciplines: only trade your setups, respect your stop losses, take profits at predetermined levels, don't over-trade. The market rewards patience and punishes impulsiveness. Keep a checklist before every trade and never deviate from it." },
    { title: "Revenge Trading", desc: "What it is and how to stop.", difficulty: "Intermediate", readTime: "5 min", content: "Revenge trading is the emotional impulse to immediately recover losses by taking impulsive trades. It typically leads to larger losses because you're trading from emotion, not logic. Signs: increasing position sizes after losses, trading setups you wouldn't normally take, feeling angry at the market. Solution: Set a daily loss limit, walk away after hitting it, journal your emotions, and remember that the market will be there tomorrow." },
    { title: "The Importance of Journaling", desc: "Your trading journal is your edge.", difficulty: "Beginner", readTime: "4 min", content: "A trading journal captures your decisions, emotions, and results. It reveals patterns you can't see in real-time: times when you trade best, setups that work, emotional triggers that cause losses. Record: entry/exit reasons, emotional state, market conditions, what you'd do differently. Review weekly. After 3 months of consistent journaling, most traders see significant improvement in their results." },
    { title: "Handling Losing Streaks", desc: "Every trader faces them. Here's how to survive.", difficulty: "Intermediate", readTime: "5 min", content: "Losing streaks are a mathematical certainty in trading. Even a 60% win rate system will experience 5+ consecutive losses. During a losing streak: reduce position size by 50%, only take A+ setups, review your journal for errors, take a day off if needed. Remember that the expected value of your strategy hasn't changed — you're experiencing normal variance. Stay the course but protect your capital." },
    { title: "FOMO and How to Overcome It", desc: "Missing a trade is better than forcing one.", difficulty: "Beginner", readTime: "4 min", content: "FOMO (Fear Of Missing Out) causes traders to enter trades late, chase price, or skip analysis. The result is poor entries and unnecessary losses. Countering FOMO: There are always more opportunities — the market trades 5 days a week, 52 weeks a year. If you missed a move, wait for the next setup. Set price alerts instead of watching charts all day. Remember: the best traders miss plenty of moves and still profit consistently." },
  ],
  Strategy: [
    { title: "London Breakout Strategy", desc: "Catching the first move of the London session.", difficulty: "Intermediate", readTime: "7 min", content: "The London Breakout Strategy capitalizes on the increased volatility when London opens (08:00 UTC). Mark the high and low of the Asian session (00:00-08:00 UTC). When London opens, place buy stop above the high and sell stop below the low. Set SL at the opposite end of the range. TP at 1:1.5 or 1:2 RR. Best pairs: GBP/USD, EUR/USD, EUR/GBP. Filter: avoid on major news days and when the Asian range is too wide (>40 pips)." },
    { title: "ICT Concepts Intro", desc: "Inner Circle Trader methodology basics.", difficulty: "Advanced", readTime: "10 min", content: "ICT (Inner Circle Trader) methodology focuses on understanding how institutional traders operate. Key concepts: Order Blocks (areas of institutional buying/selling), Fair Value Gaps (imbalances in price), Liquidity (where stop losses cluster). The theory suggests that smart money manipulates price to grab liquidity before reversing. Look for: liquidity sweeps above/below key levels followed by a market structure shift as entry signals." },
    { title: "Supply & Demand Zones", desc: "Finding where big players buy and sell.", difficulty: "Intermediate", readTime: "6 min", content: "Supply zones are areas where selling pressure overwhelmed buying (bearish). Demand zones are where buying overwhelmed selling (bullish). Identify them by finding sharp moves away from a consolidation area. The stronger the move away, the stronger the zone. Trade the first return to the zone for the highest probability. Draw zones from the base of the explosive candle, not the wick. Fresh (untested) zones are stronger than tested ones." },
    { title: "Scalping vs Swing Trading", desc: "Choosing the right style for your personality.", difficulty: "Beginner", readTime: "5 min", content: "Scalping: 1-15 minute charts, holding seconds to minutes, many trades per day, small profits per trade, requires fast execution and low spreads. Swing Trading: 1H-Daily charts, holding hours to days, few trades per week, larger profits per trade, more flexible schedule. Choose based on your personality, available time, and stress tolerance. Most beginners should start with swing trading — it's more forgiving and allows time for analysis." },
    { title: "How to Build a Trading Plan", desc: "Your blueprint for consistent profits.", difficulty: "Intermediate", readTime: "8 min", content: "A trading plan defines: 1) Markets you trade. 2) Timeframes you use. 3) Specific entry/exit criteria. 4) Risk rules (% per trade, daily max). 5) Trading hours. 6) Position sizing method. 7) Review process. Write it down and print it. Before every trade, verify it meets all criteria. A vague plan is no plan. Example: 'I trade EUR/USD on the 1H chart during London session, entering on bullish engulfing at demand zones with 1:2 RR, risking 1% per trade, max 2 trades per day.'" },
  ],
};

const difficultyColors: Record<string, string> = {
  Beginner: "bg-profit/15 text-profit",
  Intermediate: "bg-primary/15 text-primary",
  Advanced: "bg-loss/15 text-loss",
};

export default function Learning() {
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const categories = Object.keys(learningData);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <h1 className="text-lg font-semibold text-foreground">Learning Center</h1>

      <Tabs defaultValue={categories[0]}>
        <TabsList className="bg-white/[0.04] border border-white/[0.08] flex-wrap h-auto gap-1 p-1">
          {categories.map((cat) => (
            <TabsTrigger
              key={cat}
              value={cat}
              className="data-[state=active]:bg-white/[0.08] text-xs"
            >
              {cat}
            </TabsTrigger>
          ))}
        </TabsList>

        {categories.map((cat) => (
          <TabsContent key={cat} value={cat} className="mt-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {learningData[cat].map((card) => {
                const isExpanded = expandedCard === card.title;
                return (
                  <motion.div
                    key={card.title}
                    layout
                    className={`glass-card-hover p-5 cursor-pointer ${
                      isExpanded ? "md:col-span-2 xl:col-span-3" : ""
                    }`}
                    onClick={() => setExpandedCard(isExpanded ? null : card.title)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1.5">
                          <Badge variant="secondary" className={`text-[10px] ${difficultyColors[card.difficulty]}`}>
                            {card.difficulty}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Clock className="h-2.5 w-2.5" /> {card.readTime}
                          </span>
                        </div>
                        <h3 className="text-sm font-semibold text-foreground">{card.title}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">{card.desc}</p>
                      </div>
                      <ChevronRight className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                    </div>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="mt-4 pt-4 border-t border-white/[0.06]"
                      >
                        <p className="text-sm text-foreground/80 leading-relaxed">{card.content}</p>
                      </motion.div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </motion.div>
  );
}
