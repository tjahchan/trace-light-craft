import { useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  calculateOptions,
  getPositionLabel,
  getMoneynessBadge,
  type OptionsTradeInput,
} from "@/lib/options-utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info } from "lucide-react";

interface OptionsLiveSummaryProps {
  input: Partial<OptionsTradeInput>;
}

function InfoTip({ text }: { text: string }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Info className="h-3 w-3 text-muted-foreground/50 inline ml-1 cursor-help" />
        </TooltipTrigger>
        <TooltipContent className="max-w-[220px] text-xs">
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function OptionsLiveSummary({ input }: OptionsLiveSummaryProps) {
  const calc = useMemo(() => {
    if (
      !input.optionType ||
      !input.positionDirection ||
      !input.strikePrice ||
      !input.entryPremium ||
      !input.numContracts
    )
      return null;

    return calculateOptions({
      optionType: input.optionType,
      positionDirection: input.positionDirection,
      strikePrice: input.strikePrice,
      entryPremium: input.entryPremium,
      exitPremium: input.exitPremium ?? null,
      currentPremium: input.currentPremium ?? null,
      numContracts: input.numContracts,
      contractMultiplier: input.contractMultiplier || 100,
      entryFees: input.entryFees || 0,
      exitFees: input.exitFees || 0,
      underlyingPriceEntry: input.underlyingPriceEntry ?? null,
      underlyingPriceExit: input.underlyingPriceExit ?? null,
      underlyingPriceCurrent: input.underlyingPriceCurrent ?? null,
      expirationDate: input.expirationDate ?? null,
      entryDate: input.entryDate ?? null,
      capitalAtRisk: input.capitalAtRisk ?? null,
      status: input.status || "open",
    } as OptionsTradeInput);
  }, [input]);

  if (!calc) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-center">
        <p className="text-xs text-muted-foreground">
          Fill in contract details to see live calculations
        </p>
      </div>
    );
  }

  const isLong = input.positionDirection === "long";
  const posLabel = getPositionLabel(
    input.positionDirection!,
    input.optionType!
  );
  const pnl = calc.realizedPnl ?? calc.unrealizedPnl;
  const pnlLabel = calc.realizedPnl != null ? "Realized P&L" : "Unrealized P&L";
  const badge = getMoneynessBadge(calc.moneyness);

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] space-y-4 p-4">
      {/* Position header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
            Position
          </p>
          <p className="text-sm font-semibold text-foreground">{posLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          {calc.moneyness && (
            <span
              className={cn(
                "px-2 py-0.5 rounded-md text-[10px] font-semibold border",
                badge.className
              )}
            >
              {badge.label}
            </span>
          )}
          {calc.daysRemaining != null && (
            <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-white/[0.05] text-muted-foreground border border-white/[0.08]">
              {calc.daysRemaining}d left
            </span>
          )}
        </div>
      </div>

      {/* P&L hero */}
      {pnl != null && (
        <div
          className={cn(
            "rounded-lg p-3 text-center",
            pnl >= 0
              ? "bg-profit/10 border border-profit/20"
              : "bg-loss/10 border border-loss/20"
          )}
        >
          <p className="text-[10px] text-muted-foreground mb-0.5">{pnlLabel}</p>
          <p
            className={cn(
              "text-xl font-mono font-bold",
              pnl >= 0 ? "text-profit" : "text-loss"
            )}
          >
            {pnl >= 0 ? "+" : "-"}${Math.abs(pnl).toFixed(2)}
          </p>
          {calc.percentReturn != null && (
            <p
              className={cn(
                "text-xs font-mono mt-0.5",
                pnl >= 0 ? "text-profit/70" : "text-loss/70"
              )}
            >
              {calc.percentReturn >= 0 ? "+" : ""}
              {calc.percentReturn.toFixed(1)}%
              <InfoTip text={calc.percentReturnLabel} />
            </p>
          )}
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-1.5">
        <SummaryCard
          label="Contracts"
          value={`${input.numContracts} × ${input.contractMultiplier || 100}`}
        />
        <SummaryCard
          label="Entry Premium"
          value={`$${input.entryPremium?.toFixed(2) ?? "—"}`}
          mono
        />
        <SummaryCard
          label={isLong ? "Total Cost" : "Premium Collected"}
          value={`$${calc.totalEntryCost.toFixed(2)}`}
          mono
          tip={
            isLong
              ? "Premium × Multiplier × Contracts + Fees"
              : "Premium × Multiplier × Contracts - Fees"
          }
        />
        {calc.totalExitValue != null && (
          <SummaryCard
            label={isLong ? "Exit Value" : "Buyback Cost"}
            value={`$${calc.totalExitValue.toFixed(2)}`}
            mono
          />
        )}
        <SummaryCard
          label="Break-Even"
          value={`$${calc.breakEven.toFixed(2)}`}
          mono
          tip={
            input.optionType === "call"
              ? "Strike + Premium"
              : "Strike − Premium"
          }
        />
        <SummaryCard label="Total Fees" value={`$${calc.totalFees.toFixed(2)}`} mono />
        <SummaryCard label="Max Profit" value={calc.maxProfitLabel} valueClass={calc.maxProfitLabel === "Unlimited" ? "text-profit" : undefined} />
        <SummaryCard label="Max Loss" value={calc.maxLossLabel} valueClass={calc.maxLossLabel === "Unlimited" ? "text-loss" : undefined} />
      </div>

      {/* Extended stats */}
      {(calc.intrinsicValue != null || calc.notionalExposure != null) && (
        <div className="grid grid-cols-2 gap-1.5">
          {calc.intrinsicValue != null && (
            <SummaryCard
              label="Intrinsic"
              value={`$${calc.intrinsicValue.toFixed(2)}`}
              mono
              tip="For Calls: max(underlying − strike, 0). For Puts: max(strike − underlying, 0)"
            />
          )}
          {calc.extrinsicValue != null && (
            <SummaryCard
              label="Extrinsic"
              value={`$${calc.extrinsicValue.toFixed(2)}`}
              mono
              valueClass={calc.extrinsicValue < 0 ? "text-loss" : undefined}
              tip="Market Price − Intrinsic Value"
            />
          )}
          {calc.notionalExposure != null && (
            <SummaryCard
              label="Notional"
              value={`$${calc.notionalExposure.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
              mono
              tip="Underlying × Multiplier × Contracts"
            />
          )}
          {calc.distanceToStrikePct != null && (
            <SummaryCard
              label="Dist. to Strike"
              value={`${calc.distanceToStrikePct.toFixed(1)}%`}
              mono
            />
          )}
          {calc.daysToExpiration != null && (
            <SummaryCard label="DTE at Entry" value={`${calc.daysToExpiration}d`} />
          )}
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  mono,
  valueClass,
  tip,
}: {
  label: string;
  value: string;
  mono?: boolean;
  valueClass?: string;
  tip?: string;
}) {
  return (
    <div className="p-2 rounded-lg bg-white/[0.03] border border-white/[0.05]">
      <p className="text-[9px] text-muted-foreground uppercase tracking-wider">
        {label}
        {tip && <InfoTip text={tip} />}
      </p>
      <p
        className={cn(
          "text-xs font-medium text-foreground mt-0.5",
          mono && "font-mono",
          valueClass
        )}
      >
        {value}
      </p>
    </div>
  );
}
