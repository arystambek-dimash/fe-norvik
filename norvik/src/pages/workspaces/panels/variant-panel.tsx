import { useState } from "react";
import { usePlannerStore } from "@/stores/planner-store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { RefreshCw, ChevronDown, ChevronUp, Layers } from "lucide-react";
import type { SolverVariant, ScoreBreakdown, CategoryDetail } from "@/algorithm/types";
import { CATEGORY_WEIGHTS } from "@/algorithm/scoring";

interface VariantPanelProps {
  onRegenerate: () => void;
}

type CategoryKey = keyof typeof CATEGORY_WEIGHTS;

const CATEGORY_LABELS: { key: CategoryKey; label: string }[] = [
  { key: "ergonomics", label: "Ergonomics" },
  { key: "workflow", label: "Workflow" },
  { key: "aesthetics", label: "Aesthetics" },
  { key: "manufacturability", label: "Manufacturability" },
  { key: "preferences", label: "Preferences" },
];

function CategoryRow({ label, weightPct, detail }: { label: string; weightPct: number; detail: CategoryDetail }) {
  const [expanded, setExpanded] = useState(false);
  const subEntries = Object.entries(detail.subMetrics);

  return (
    <div>
      <button
        type="button"
        onClick={() => subEntries.length > 0 && setExpanded(!expanded)}
        className="flex w-full items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <span>{label} <span className="opacity-50">({weightPct}%)</span></span>
        <span className="font-mono">{detail.score.toFixed(1)}</span>
      </button>
      {expanded && subEntries.length > 0 && (
        <div className="ml-3 mt-0.5 space-y-0.5">
          {subEntries.map(([name, value]) => (
            <div key={name} className="flex items-center justify-between text-[10px] text-muted-foreground/70">
              <span>{name}</span>
              <span className="font-mono">{value.toFixed(1)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ScoreBreakdownView({ breakdown }: { breakdown: ScoreBreakdown }) {
  return (
    <div className="mt-2 space-y-1.5 border-t border-border/40 pt-2">
      {!breakdown.hardConstraintsPassed && (
        <div className="text-xs text-destructive font-medium">
          Hard constraints violated
        </div>
      )}
      {CATEGORY_LABELS.map(({ key, label }) => (
        <CategoryRow key={key} label={label} weightPct={CATEGORY_WEIGHTS[key] * 100} detail={breakdown[key]} />
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
