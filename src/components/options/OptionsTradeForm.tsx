import { useState, useMemo } from "react";
import { format } from "date-fns";
import { deriveBreakEven } from "@/lib/options/calculations";
import { CalendarIcon, Clock, ChevronDown, ChevronRight, Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import {
  validateOptionsInput,
  calculateOptions,
  type OptionType,
  type PositionDirection,
  type OptionStatus,
  type OptionsTradeInput,
} from "@/lib/options-utils";


interface OptionsTradeFormProps {
  accountId: string;
  onTradeCreated?: () => void;
  onClose?: () => void;
}

function FieldTip({ text }: { text: string }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Info className="h-3 w-3 text-muted-foreground/40 cursor-help ml-1 inline" />
        </TooltipTrigger>
        <TooltipContent className="max-w-[200px] text-xs">{text}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function OptionsTradeForm({ accountId, onTradeCreated, onClose }: OptionsTradeFormProps) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [greeksOpen, setGreeksOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);

  // Contract details
  const [underlyingTicker, setUnderlyingTicker] = useState("");
  const [optionType, setOptionType] = useState<OptionType | "">("");
  const [positionDirection, setPositionDirection] = useState<PositionDirection | "">("");
  const [strikePrice, setStrikePrice] = useState("");
  const [expirationDate, setExpirationDate] = useState<Date | undefined>();
  const [contractMultiplier, setContractMultiplier] = useState("100");
  const [numContracts, setNumContracts] = useState("");

  // Position details
  const [entryPremium, setEntryPremium] = useState("");
  const [exitPremium, setExitPremium] = useState("");
  const [currentPremium, setCurrentPremium] = useState("");
  const [entryDate, setEntryDate] = useState<Date | undefined>(new Date());
  const [entryHour, setEntryHour] = useState("12");
  const [entryMinute, setEntryMinute] = useState("00");
  const [entryAmpm, setEntryAmpm] = useState<"AM" | "PM">("AM");
  const [entryFees, setEntryFees] = useState("");
  const [exitFees, setExitFees] = useState("");
  const [capitalAtRisk, setCapitalAtRisk] = useState("");

  // Status
  const [status, setStatus] = useState<OptionStatus>("open");

  // Underlying context
  const [underlyingEntry, setUnderlyingEntry] = useState("");
  const [underlyingExit, setUnderlyingExit] = useState("");
  const [underlyingCurrent, setUnderlyingCurrent] = useState("");
  const [ivEntry, setIvEntry] = useState("");
  const [ivExit, setIvExit] = useState("");

  // Greeks
  const [delta, setDelta] = useState("");
  const [gamma, setGamma] = useState("");
  const [theta, setTheta] = useState("");
  const [vega, setVega] = useState("");
  const [rho, setRho] = useState("");

  // Journal
  const [tags, setTags] = useState("");
  const [thesis, setThesis] = useState("");
  const [entryReason, setEntryReason] = useState("");
  const [exitReason, setExitReason] = useState("");
  const [notes, setNotes] = useState("");

  // Build live summary input
  const summaryInput: Partial<OptionsTradeInput> = useMemo(() => ({
    optionType: optionType as OptionType || undefined,
    positionDirection: positionDirection as PositionDirection || undefined,
    strikePrice: parseFloat(strikePrice) || undefined,
    entryPremium: parseFloat(entryPremium) || undefined,
    exitPremium: exitPremium ? parseFloat(exitPremium) : undefined,
    currentPremium: currentPremium ? parseFloat(currentPremium) : undefined,
    numContracts: parseInt(numContracts) || undefined,
    contractMultiplier: parseInt(contractMultiplier) || 100,
    entryFees: parseFloat(entryFees) || 0,
    exitFees: parseFloat(exitFees) || 0,
    underlyingPriceEntry: parseFloat(underlyingEntry) || undefined,
    underlyingPriceExit: parseFloat(underlyingExit) || undefined,
    underlyingPriceCurrent: parseFloat(underlyingCurrent) || undefined,
    expirationDate: expirationDate?.toISOString() || undefined,
    entryDate: entryDate?.toISOString() || undefined,
    capitalAtRisk: parseFloat(capitalAtRisk) || undefined,
    status,
  }), [optionType, positionDirection, strikePrice, entryPremium, exitPremium, currentPremium,
    numContracts, contractMultiplier, entryFees, exitFees, underlyingEntry, underlyingExit,
    underlyingCurrent, expirationDate, entryDate, capitalAtRisk, status]);

  const buildDateTime = () => {
    if (!entryDate) return null;
    const d = new Date(entryDate);
    let h = parseInt(entryHour) || 12;
    if (entryAmpm === "PM" && h !== 12) h += 12;
    if (entryAmpm === "AM" && h === 12) h = 0;
    d.setHours(h, parseInt(entryMinute) || 0, 0, 0);
    return d.toISOString();
  };

  const handleSave = async () => {
    if (!user || !accountId) {
      toast({ title: "No account selected", variant: "destructive" });
      return;
    }

    const errors = validateOptionsInput(summaryInput as Partial<OptionsTradeInput>);
    if (errors.length > 0) {
      toast({ title: "Validation Error", description: errors[0], variant: "destructive" });
      return;
    }

    setSaving(true);

    const ep = parseFloat(entryPremium);
    const xp = exitPremium ? parseFloat(exitPremium) : null;
    const mult = parseInt(contractMultiplier) || 100;
    const contracts = parseInt(numContracts);
    const eFees = parseFloat(entryFees) || 0;
    const xFees = parseFloat(exitFees) || 0;

    // Calculate PnL using options engine
    let pnl: number | null = null;
    if (status !== "open" && summaryInput.optionType && summaryInput.positionDirection) {
      const calc = calculateOptions({
        ...summaryInput,
        optionType: summaryInput.optionType,
        positionDirection: summaryInput.positionDirection,
        strikePrice: parseFloat(strikePrice),
        entryPremium: ep,
        exitPremium: status === "expired" ? 0 : xp,
        numContracts: contracts,
        contractMultiplier: mult,
        entryFees: eFees,
        exitFees: xFees,
        status,
      } as OptionsTradeInput);
      pnl = calc.realizedPnl;
    }

    const dateTime = buildDateTime();
    const tagArr = tags ? tags.split(",").map(t => t.trim()).filter(Boolean) : [];

    // Use a symbol format: TICKER STRIKE C/P EXP
    const optSymbol = `${underlyingTicker.toUpperCase()} ${strikePrice}${optionType === "call" ? "C" : "P"} ${expirationDate ? format(expirationDate, "MMdd") : ""}`;

    const tradeData: Record<string, any> = {
      user_id: user.id,
      account_id: accountId,
      symbol: optSymbol.trim(),
      side: positionDirection === "long" ? "Long" : "Short",
      quantity: contracts,
      entry_price: ep,
      exit_price: xp,
      pnl,
      status: status === "expired" ? "closed" : status,
      open_time: dateTime,
      close_time: status !== "open" ? dateTime : null,
      tags: tagArr,
      note: [thesis, notes].filter(Boolean).join("\n\n"),
      commissions: eFees + xFees,
      // Options-specific fields
      trade_type: "options",
      option_type: optionType,
      position_direction: positionDirection,
      strike_price: parseFloat(strikePrice),
      expiration_date: expirationDate?.toISOString().split("T")[0] || null,
      contract_multiplier: mult,
      num_contracts: contracts,
      entry_premium: ep,
      exit_premium: xp,
      current_premium: currentPremium ? parseFloat(currentPremium) : null,
      underlying_price_entry: parseFloat(underlyingEntry) || null,
      underlying_price_exit: parseFloat(underlyingExit) || null,
      underlying_price_current: parseFloat(underlyingCurrent) || null,
      iv_entry: parseFloat(ivEntry) || null,
      iv_exit: parseFloat(ivExit) || null,
      delta: parseFloat(delta) || null,
      gamma: parseFloat(gamma) || null,
      theta: parseFloat(theta) || null,
      vega: parseFloat(vega) || null,
      rho: parseFloat(rho) || null,
      option_status: status,
      capital_at_risk: parseFloat(capitalAtRisk) || null,
      strategy_label: "Single Leg",
      entry_fees: eFees,
      exit_fees: xFees,
      underlying_ticker: underlyingTicker.toUpperCase(),
      directional_thesis: thesis || null,
      entry_reason: entryReason || null,
      exit_reason: exitReason || null,
    };

    const { error } = await supabase.from("trades").insert(tradeData as any);

    setSaving(false);
    if (error) {
      console.error("Options trade insert error:", error);
      toast({ title: "Failed to save options trade", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: status !== "open" ? "Options trade saved" : "Options position opened" });
    onTradeCreated?.();
    onClose?.();
  };

  const isClosed = status !== "open";

  const inputCls = "bg-white/[0.04] border-white/[0.08] font-mono";
  const labelCls = "text-[10px] text-muted-foreground uppercase tracking-wider";

  // Compact inline P&L calculation
  const inlinePnl = useMemo(() => {
    const ep = parseFloat(entryPremium);
    const cp = currentPremium ? parseFloat(currentPremium) : null;
    const xp = exitPremium ? parseFloat(exitPremium) : null;
    const mult = parseInt(contractMultiplier) || 100;
    const contracts = parseInt(numContracts) || 0;
    const eFees = parseFloat(entryFees) || 0;
    const dir = positionDirection as PositionDirection;
    if (!dir || !ep || !contracts) return null;

    const markPrice = isClosed ? xp : cp;
    if (markPrice == null) return null;

    const pnl = dir === "long"
      ? (markPrice - ep) * mult * contracts - eFees
      : (ep - markPrice) * mult * contracts - eFees;
    return pnl;
  }, [entryPremium, exitPremium, currentPremium, contractMultiplier, numContracts, entryFees, positionDirection, isClosed]);

  const breakEven = useMemo(() => {
    const strike = parseFloat(strikePrice);
    const ep = parseFloat(entryPremium);
    const ot = optionType as OptionType;
    if (!strike || !ep || !ot) return null;
    return deriveBreakEven(ot, strike, ep);
  }, [strikePrice, entryPremium, optionType]);

  const positionSummary = useMemo(() => {
    const parts: string[] = [];
    if (optionType) parts.push(optionType.toUpperCase());
    if (positionDirection) parts.push(positionDirection.toUpperCase());
    const c = parseInt(numContracts);
    if (c) parts.push(`${c} CONTRACT${c > 1 ? "S" : ""}`);
    return parts.join(" • ");
  }, [optionType, positionDirection, numContracts]);

  return (
    <div className="space-y-5 max-h-[75vh] overflow-y-auto pr-1">
        {/* Status selector */}
        <div className="flex rounded-xl bg-white/[0.05] p-1 gap-0.5">
          {(["open", "closed", "expired"] as OptionStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={cn(
                "flex-1 py-2 rounded-lg text-xs font-medium transition-colors capitalize",
                status === s
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {s === "expired" ? "Expired Worthless" : s}
            </button>
          ))}
        </div>

        {/* Section: Contract Details */}
        <div className="space-y-3">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Contract Details</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className={labelCls}>Underlying Ticker</Label>
              <Input placeholder="AAPL" value={underlyingTicker} onChange={(e) => setUnderlyingTicker(e.target.value)} className={cn("mt-1", inputCls)} />
            </div>
            <div>
              <Label className={labelCls}>Option Type</Label>
              <Select value={optionType} onValueChange={(v) => setOptionType(v as OptionType)}>
                <SelectTrigger className={cn("mt-1", inputCls)}><SelectValue placeholder="Call / Put" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="call">Call</SelectItem>
                  <SelectItem value="put">Put</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className={labelCls}>Direction</Label>
              <Select value={positionDirection} onValueChange={(v) => setPositionDirection(v as PositionDirection)}>
                <SelectTrigger className={cn("mt-1", inputCls)}><SelectValue placeholder="Long / Short" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="long">Long</SelectItem>
                  <SelectItem value="short">Short</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className={labelCls}>Strike Price</Label>
              <Input type="number" placeholder="150.00" value={strikePrice} onChange={(e) => setStrikePrice(e.target.value)} className={cn("mt-1", inputCls)} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className={labelCls}>Contracts</Label>
              <Input type="number" placeholder="1" value={numContracts} onChange={(e) => setNumContracts(e.target.value)} className={cn("mt-1", inputCls)} />
            </div>
            <div>
              <Label className={labelCls}>
                Multiplier <FieldTip text="Standard options = 100. Mini options = 10." />
              </Label>
              <Input type="number" value={contractMultiplier} onChange={(e) => setContractMultiplier(e.target.value)} className={cn("mt-1", inputCls)} />
            </div>
            <div>
              <Label className={labelCls}>Expiration</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full mt-1 justify-start text-left font-normal", inputCls, !expirationDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                    {expirationDate ? format(expirationDate, "MMM d") : "Expiry"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 backdrop-blur-xl bg-black/80 border-white/[0.1]" align="start">
                  <Calendar mode="single" selected={expirationDate} onSelect={setExpirationDate} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>

        {/* Section: Pricing */}
        <div className="space-y-3">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Pricing</p>
          <div className={cn("grid gap-3", isClosed ? "grid-cols-3" : "grid-cols-2")}>
            <div>
              <Label className={labelCls}>
                Entry Premium <FieldTip text="Price per share of the option contract" />
              </Label>
              <Input type="number" step="0.01" placeholder="2.35" value={entryPremium} onChange={(e) => setEntryPremium(e.target.value)} className={cn("mt-1", inputCls)} />
            </div>
            {isClosed && (
              <div>
                <Label className={labelCls}>Exit Premium</Label>
                <Input type="number" step="0.01" placeholder="3.50" value={exitPremium} onChange={(e) => setExitPremium(e.target.value)} className={cn("mt-1", inputCls)} />
              </div>
            )}
            {!isClosed && (
              <div>
                <Label className={labelCls}>Current Premium</Label>
                <Input type="number" step="0.01" placeholder="2.80" value={currentPremium} onChange={(e) => setCurrentPremium(e.target.value)} className={cn("mt-1", inputCls)} />
              </div>
            )}
            <div>
              <Label className={labelCls}>Entry Fees</Label>
              <Input type="number" step="0.01" placeholder="0.65" value={entryFees} onChange={(e) => setEntryFees(e.target.value)} className={cn("mt-1", inputCls)} />
            </div>
          </div>
          {isClosed && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className={labelCls}>Exit Fees</Label>
                <Input type="number" step="0.01" placeholder="0.65" value={exitFees} onChange={(e) => setExitFees(e.target.value)} className={cn("mt-1", inputCls)} />
              </div>
              {positionDirection === "short" && (
                <div>
                  <Label className={labelCls}>
                    Capital at Risk <FieldTip text="Margin or collateral for accurate % return on short trades" />
                  </Label>
                  <Input type="number" placeholder="5000" value={capitalAtRisk} onChange={(e) => setCapitalAtRisk(e.target.value)} className={cn("mt-1", inputCls)} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Inline Estimated P&L Card */}
        <div className={cn(
          "rounded-xl p-4 text-center font-mono border",
          inlinePnl != null && inlinePnl > 0
            ? "bg-profit/10 border-profit/20"
            : inlinePnl != null && inlinePnl < 0
              ? "bg-loss/10 border-loss/20"
              : "bg-white/[0.03] border-white/[0.06]"
        )}>
          <p className="text-[10px] text-muted-foreground mb-1">
            {isClosed ? "Estimated P&L" : "Estimated (Unrealized)"}
          </p>
          <p className={cn(
            "text-2xl font-medium",
            inlinePnl != null && inlinePnl >= 0 ? "text-profit" : inlinePnl != null ? "text-loss" : "text-muted-foreground"
          )}>
            {inlinePnl != null
              ? `${inlinePnl >= 0 ? "+" : ""}$${Math.abs(inlinePnl).toFixed(2)}`
              : "Enter current price"}
          </p>
          {breakEven != null && (
            <p className="text-xs text-muted-foreground mt-1.5">
              Break-Even: <span className="font-mono text-foreground">${breakEven.toFixed(2)}</span>
            </p>
          )}
          {positionSummary && (
            <p className="text-[10px] text-muted-foreground mt-1">{positionSummary}</p>
          )}
        </div>

        {/* Entry Date/Time */}
        <div className="space-y-3">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Date & Time</p>
          <div className="grid grid-cols-2 gap-3">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("justify-start text-left font-normal", inputCls, !entryDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {entryDate ? format(entryDate, "MMM d, yyyy") : "Entry date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 backdrop-blur-xl bg-black/80 border-white/[0.1]" align="start">
                <Calendar mode="single" selected={entryDate} onSelect={setEntryDate} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
              <Input type="number" min={1} max={12} value={entryHour} onChange={(e) => setEntryHour(e.target.value.slice(0, 2))} className={cn("w-14 text-center px-1", inputCls)} />
              <span className="text-muted-foreground">:</span>
              <Input type="number" min={0} max={59} value={entryMinute} onChange={(e) => setEntryMinute(e.target.value.slice(0, 2))} className={cn("w-14 text-center px-1", inputCls)} />
              <button onClick={() => setEntryAmpm(entryAmpm === "AM" ? "PM" : "AM")} className="px-2 py-1.5 rounded-md bg-white/[0.06] border border-white/[0.08] text-xs font-medium text-foreground hover:bg-white/[0.1] transition-colors">
                {entryAmpm}
              </button>
            </div>
          </div>
        </div>

        {/* Underlying Context - Collapsible */}
        <Collapsible open={contextOpen} onOpenChange={setContextOpen}>
          <CollapsibleTrigger className="flex items-center gap-1.5 w-full text-[11px] text-muted-foreground uppercase tracking-wider font-semibold hover:text-foreground transition-colors">
            {contextOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            Underlying & Volatility
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 mt-3">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className={labelCls}>Underlying @ Entry</Label>
                <Input type="number" placeholder="152.30" value={underlyingEntry} onChange={(e) => setUnderlyingEntry(e.target.value)} className={cn("mt-1", inputCls)} />
              </div>
              <div>
                <Label className={labelCls}>Underlying @ Exit</Label>
                <Input type="number" placeholder="155.00" value={underlyingExit} onChange={(e) => setUnderlyingExit(e.target.value)} className={cn("mt-1", inputCls)} />
              </div>
              <div>
                <Label className={labelCls}>Current Underlying</Label>
                <Input type="number" placeholder="153.50" value={underlyingCurrent} onChange={(e) => setUnderlyingCurrent(e.target.value)} className={cn("mt-1", inputCls)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className={labelCls}>IV at Entry (%)</Label>
                <Input type="number" step="0.1" placeholder="32.5" value={ivEntry} onChange={(e) => setIvEntry(e.target.value)} className={cn("mt-1", inputCls)} />
              </div>
              <div>
                <Label className={labelCls}>IV at Exit / Current (%)</Label>
                <Input type="number" step="0.1" placeholder="28.3" value={ivExit} onChange={(e) => setIvExit(e.target.value)} className={cn("mt-1", inputCls)} />
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Greeks - Collapsible */}
        <Collapsible open={greeksOpen} onOpenChange={setGreeksOpen}>
          <CollapsibleTrigger className="flex items-center gap-1.5 w-full text-[11px] text-muted-foreground uppercase tracking-wider font-semibold hover:text-foreground transition-colors">
            {greeksOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            Greeks
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 mt-3">
            <div className="grid grid-cols-5 gap-2">
              <div>
                <Label className={labelCls}>
                  Delta <FieldTip text="Rate of change of option price per $1 move in underlying" />
                </Label>
                <Input type="number" step="0.01" placeholder="0.45" value={delta} onChange={(e) => setDelta(e.target.value)} className={cn("mt-1 text-xs", inputCls)} />
              </div>
              <div>
                <Label className={labelCls}>
                  Gamma <FieldTip text="Rate of change of delta" />
                </Label>
                <Input type="number" step="0.001" placeholder="0.03" value={gamma} onChange={(e) => setGamma(e.target.value)} className={cn("mt-1 text-xs", inputCls)} />
              </div>
              <div>
                <Label className={labelCls}>
                  Theta <FieldTip text="Daily time decay of option value" />
                </Label>
                <Input type="number" step="0.01" placeholder="-0.05" value={theta} onChange={(e) => setTheta(e.target.value)} className={cn("mt-1 text-xs", inputCls)} />
              </div>
              <div>
                <Label className={labelCls}>
                  Vega <FieldTip text="Sensitivity to 1% change in implied volatility" />
                </Label>
                <Input type="number" step="0.01" placeholder="0.12" value={vega} onChange={(e) => setVega(e.target.value)} className={cn("mt-1 text-xs", inputCls)} />
              </div>
              <div>
                <Label className={labelCls}>
                  Rho <FieldTip text="Sensitivity to interest rate changes" />
                </Label>
                <Input type="number" step="0.01" placeholder="0.02" value={rho} onChange={(e) => setRho(e.target.value)} className={cn("mt-1 text-xs", inputCls)} />
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Journal / Notes */}
        <div className="space-y-3">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Trade Journal</p>
          <div>
            <Label className={labelCls}>Directional Thesis</Label>
            <Textarea placeholder="Why did you take this trade?" value={thesis} onChange={(e) => setThesis(e.target.value)} className={cn("mt-1 resize-none", inputCls)} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className={labelCls}>Entry Reason</Label>
              <Input placeholder="Earnings play, support bounce..." value={entryReason} onChange={(e) => setEntryReason(e.target.value)} className={cn("mt-1", inputCls)} />
            </div>
            <div>
              <Label className={labelCls}>Exit Reason</Label>
              <Input placeholder="Hit target, stopped out..." value={exitReason} onChange={(e) => setExitReason(e.target.value)} className={cn("mt-1", inputCls)} />
            </div>
          </div>
          <div>
            <Label className={labelCls}>Tags</Label>
            <Input placeholder="Earnings, Momentum, Scalp" value={tags} onChange={(e) => setTags(e.target.value)} className={cn("mt-1", inputCls)} />
          </div>
          <div>
            <Label className={labelCls}>Notes</Label>
            <Textarea placeholder="Additional notes..." value={notes} onChange={(e) => setNotes(e.target.value)} className={cn("mt-1 resize-none", inputCls)} rows={2} />
          </div>
        </div>

        {/* How calculations work */}
        <Collapsible>
          <CollapsibleTrigger className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60 uppercase tracking-wider hover:text-muted-foreground transition-colors">
            <Info className="h-3 w-3" /> How calculations work
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 rounded-lg bg-white/[0.02] border border-white/[0.05] p-3 text-[11px] text-muted-foreground space-y-1.5">
            <p><strong>Total Cost</strong> = Premium × Multiplier × Contracts + Fees</p>
            <p><strong>Break-Even (Call)</strong> = Strike + Premium</p>
            <p><strong>Break-Even (Put)</strong> = Strike − Premium</p>
            <p><strong>P&L (Long)</strong> = (Exit − Entry) × Multiplier × Contracts − Fees</p>
            <p><strong>P&L (Short)</strong> = (Entry − Exit) × Multiplier × Contracts − Fees</p>
            <p><strong>Intrinsic (Call)</strong> = max(Underlying − Strike, 0)</p>
            <p><strong>Intrinsic (Put)</strong> = max(Strike − Underlying, 0)</p>
          </CollapsibleContent>
        </Collapsible>

        {/* CTA at bottom */}
        <Button className="w-full mt-2" onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : status !== "open" ? "Save Options Trade" : "Open Options Position"}
        </Button>
    </div>
  );
}
