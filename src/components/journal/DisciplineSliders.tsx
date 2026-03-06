import { Slider } from "@/components/ui/slider";

interface DisciplineSlidersProps {
  confidence: number;
  execution: number;
  discipline: number;
  onChange: (field: "confidence" | "execution" | "discipline", value: number) => void;
}

export function DisciplineSliders({ confidence, execution, discipline, onChange }: DisciplineSlidersProps) {
  const items = [
    { label: "Confidence", value: confidence, field: "confidence" as const },
    { label: "Execution", value: execution, field: "execution" as const },
    { label: "Discipline", value: discipline, field: "discipline" as const },
  ];

  return (
    <div className="space-y-4">
      <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Discipline Metrics</p>
      {items.map((item) => (
        <div key={item.field} className="space-y-1.5">
          <div className="flex justify-between items-center">
            <span className="text-xs text-foreground/80">{item.label}</span>
            <span className="text-xs font-mono text-primary font-medium">{item.value}/10</span>
          </div>
          <Slider
            value={[item.value]}
            onValueChange={([v]) => onChange(item.field, v)}
            min={1}
            max={10}
            step={1}
            className="w-full"
          />
        </div>
      ))}
    </div>
  );
}
