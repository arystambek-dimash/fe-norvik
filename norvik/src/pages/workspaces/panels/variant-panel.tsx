import { useState } from "react";
import { usePlannerStore } from "@/stores/planner-store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { RefreshCw, ChevronDown, ChevronUp, Layers } from "lucide-react";
import type { SolverVariant, ScoreBreakdown } from "@/algorithm/types";

interface VariantPanelProps {
  onRegenerate: () => void;
}

function ScoreBreakdownView({ breakdown }: { breakdown: ScoreBreakdown }) {
  const entries: { label: string; key: keyof ScoreBreakdown }[] = [
    { label: "Width Consistency", key: "widthConsistency" },
    { label: "Module Sweet Spot", key: "moduleSweetSpot" },
    { label: "Ergonomic Placement", key: "ergonomicPlacement" },
    { label: "Filler Penalty", key: "fillerPenalty" },
    { label: "Symmetry", key: "symmetry" },
    { label: "Aesthetic Grouping", key: "aestheticGrouping" },
    { label: "Visual Composition", key: "visualComposition" },
    { label: "Working Triangle", key: "workingTriangle" },
    { label: "Upper Coverage", key: "upperCoverage" },
    { label: "Corner Fit", key: "cornerFit" },
  ];

  return (
    <div className="mt-2 space-y-1 border-t border-border/40 pt-2">
      {entries.map(({ label, key }) => (
        <div key={key} className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{label}</span>
          <span className="font-mono">{(breakdown[key] ?? 0).toFixed(1)}</span>
        </div>
      ))}
    </div>
  );
}

function VariantCard({
  variant,
  index,
  isActive,
  onSelect,
}: {
  variant: SolverVariant;
  index: number;
  isActive: boolean;
  onSelect: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const totalModules = variant.plan.walls.reduce(
    (sum, wall) => sum + wall.modules.length,
    0,
  );

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(); }}
      className={cn(
        "w-full rounded-xl border p-3 text-left transition-colors cursor-pointer",
        isActive
          ? "border-primary bg-primary/5"
          : "border-border/60 hover:border-primary/30 hover:bg-accent/30",
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-semibold">
            {variant.rank}
          </span>
          <span className="text-sm font-medium">Variant {variant.rank}</span>
        </div>
        <Badge variant="secondary" className="font-mono text-xs">
          Score: {Math.round(variant.plan.score)}
        </Badge>
      </div>

      <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Layers className="size-3" />
          {totalModules} modules
        </span>
        <span>{variant.plan.walls.length} wall{variant.plan.walls.length !== 1 ? "s" : ""}</span>
      </div>

      <div className="mt-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {expanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
          Score breakdown
        </button>
        {expanded && <ScoreBreakdownView breakdown={variant.plan.scoreBreakdown} />}
      </div>
    </div>
  );
}

export default function VariantPanel({ onRegenerate }: VariantPanelProps) {
  const variants = usePlannerStore((s) => s.variants) as SolverVariant[];
  const selectedVariantIndex = usePlannerStore((s) => s.selectedVariantIndex);
  const setSelectedVariantIndex = usePlannerStore((s) => s.setSelectedVariantIndex);

  if (variants.length === 0) {
    return (
      <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/60 p-4 text-center">
        <Layers className="size-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">
          No variants generated yet. Complete the wizard to generate plans.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold tracking-tight font-display">Generated Variants</h3>

      <div className="flex max-h-[480px] flex-col gap-2 overflow-y-auto pr-1">
        {variants.map((variant, index) => (
          <VariantCard
            key={index}
            variant={variant}
            index={index}
            isActive={index === selectedVariantIndex}
            onSelect={() => setSelectedVariantIndex(index)}
          />
        ))}
      </div>

      <Button
        variant="outline"
        className="mt-1 w-full rounded-lg"
        onClick={onRegenerate}
      >
        <RefreshCw className="mr-2 size-4" />
        Regenerate
      </Button>
    </div>
  );
}
