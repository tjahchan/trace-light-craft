import { useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ClosedPositionFilters {
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  symbol: string;
  direction: "all" | "Long" | "Short";
}

const emptyFilters: ClosedPositionFilters = {
  dateFrom: undefined,
  dateTo: undefined,
  symbol: "",
  direction: "all",
};

interface ClosedPositionsFilterProps {
  open: boolean;
  onClose: () => void;
  filters: ClosedPositionFilters;
  onApply: (filters: ClosedPositionFilters) => void;
  symbols: string[];
}

export function ClosedPositionsFilter({
  open,
  onClose,
  filters,
  onApply,
  symbols,
}: ClosedPositionsFilterProps) {
  const [local, setLocal] = useState<ClosedPositionFilters>(filters);

  if (!open) return null;

  const hasFilters =
    local.dateFrom || local.dateTo || local.symbol || local.direction !== "all";

  return (
    <div className="backdrop-blur-xl bg-black/60 border border-white/[0.1] rounded-xl p-4 mb-3 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground uppercase tracking-widest">Filters</p>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Date Range */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-foreground text-xs">Date From</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-start bg-white/[0.05] border-white/[0.08] text-foreground font-normal text-xs"
              >
                <CalendarIcon className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                {local.dateFrom ? format(local.dateFrom, "MMM d, yy") : "Start"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={local.dateFrom}
                onSelect={(d) => setLocal({ ...local, dateFrom: d })}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-1.5">
          <Label className="text-foreground text-xs">Date To</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-start bg-white/[0.05] border-white/[0.08] text-foreground font-normal text-xs"
              >
                <CalendarIcon className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                {local.dateTo ? format(local.dateTo, "MMM d, yy") : "End"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={local.dateTo}
                onSelect={(d) => setLocal({ ...local, dateTo: d })}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Symbol */}
      <div className="space-y-1.5">
        <Label className="text-foreground text-xs">Symbol</Label>
        <Select value={local.symbol || "all"} onValueChange={(v) => setLocal({ ...local, symbol: v === "all" ? "" : v })}>
          <SelectTrigger className="bg-white/[0.05] border-white/[0.08] text-foreground text-xs">
            <SelectValue placeholder="All symbols" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Symbols</SelectItem>
            {symbols.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Direction */}
      <div className="space-y-1.5">
        <Label className="text-foreground text-xs">Direction</Label>
        <Select value={local.direction} onValueChange={(v) => setLocal({ ...local, direction: v as any })}>
          <SelectTrigger className="bg-white/[0.05] border-white/[0.08] text-foreground text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="Long">Long</SelectItem>
            <SelectItem value="Short">Short</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 bg-white/[0.04] border-white/[0.08] text-foreground text-xs"
          onClick={() => {
            setLocal(emptyFilters);
            onApply(emptyFilters);
          }}
        >
          Clear Filters
        </Button>
        <Button
          size="sm"
          className="flex-1 text-xs"
          onClick={() => {
            onApply(local);
            onClose();
          }}
        >
          Apply
        </Button>
      </div>
    </div>
  );
}

export function hasActiveFilters(filters: ClosedPositionFilters): boolean {
  return !!(filters.dateFrom || filters.dateTo || filters.symbol || filters.direction !== "all");
}

export function applyFilters(
  positions: any[],
  filters: ClosedPositionFilters
): any[] {
  return positions.filter((pos) => {
    if (filters.dateFrom) {
      const closedDate = new Date(pos.closedAt);
      if (closedDate < filters.dateFrom) return false;
    }
    if (filters.dateTo) {
      const closedDate = new Date(pos.closedAt);
      if (closedDate > filters.dateTo) return false;
    }
    if (filters.symbol && pos.symbol !== filters.symbol) return false;
    if (filters.direction !== "all" && pos.side !== filters.direction) return false;
    return true;
  });
}
