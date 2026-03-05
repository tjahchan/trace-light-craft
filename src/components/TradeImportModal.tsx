import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Textarea } from "@/components/ui/textarea";

interface TradeImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TradeImportModal({ open, onOpenChange }: TradeImportModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card border-white/[0.08] bg-card max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-foreground">Import Trade</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Symbol</Label>
              <Input placeholder="EUR/USD" className="mt-1 bg-white/[0.04] border-white/[0.08]" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Side</Label>
              <Select>
                <SelectTrigger className="mt-1 bg-white/[0.04] border-white/[0.08]">
                  <SelectValue placeholder="Long / Short" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="long">Long</SelectItem>
                  <SelectItem value="short">Short</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Qty</Label>
              <Input type="number" placeholder="1.0" className="mt-1 bg-white/[0.04] border-white/[0.08] font-mono" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Entry</Label>
              <Input type="number" placeholder="1.0842" className="mt-1 bg-white/[0.04] border-white/[0.08] font-mono" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Exit</Label>
              <Input type="number" placeholder="1.0891" className="mt-1 bg-white/[0.04] border-white/[0.08] font-mono" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Take Profit</Label>
              <Input type="number" placeholder="TP" className="mt-1 bg-white/[0.04] border-white/[0.08] font-mono" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Stop Loss</Label>
              <Input type="number" placeholder="SL" className="mt-1 bg-white/[0.04] border-white/[0.08] font-mono" />
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Date & Time</Label>
            <Input type="datetime-local" className="mt-1 bg-white/[0.04] border-white/[0.08]" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Tags</Label>
              <Input placeholder="Scalp, Breakout" className="mt-1 bg-white/[0.04] border-white/[0.08]" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Alias</Label>
              <Input placeholder="Morning Dip" className="mt-1 bg-white/[0.04] border-white/[0.08]" />
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Notes</Label>
            <Textarea placeholder="Trade notes..." className="mt-1 bg-white/[0.04] border-white/[0.08] resize-none" rows={2} />
          </div>
          <Button className="w-full mt-2">Save Trade</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
