import { useState, useEffect } from "react";
import { usePlannerStore } from "@/stores/planner-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { X, Box, Palette } from "lucide-react";
import type { SolverVariant, PlacedModule } from "@/algorithm/types";

interface ModulePanelProps {
  onColorChange: (moduleId: string, color: string) => void;
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

function typeLabel(type: PlacedModule["type"]): string {
  switch (type) {
    case "lower":
      return "Lower Cabinet";
    case "upper":
      return "Upper Cabinet";
    case "tall":
      return "Tall Cabinet";
    case "filler":
      return "Filler";
    case "corner":
      return "Corner Cabinet";
    default:
      return type;
  }
}

export default function ModulePanel({ onColorChange }: ModulePanelProps) {
  const selectedModuleId = usePlannerStore((s) => s.selectedModuleId);
  const setSelectedModuleId = usePlannerStore((s) => s.setSelectedModuleId);
  const variants = usePlannerStore((s) => s.variants) as SolverVariant[];
  const selectedVariantIndex = usePlannerStore((s) => s.selectedVariantIndex);

  const [color, setColor] = useState("#6b7280");

  // Find the selected module across all walls of the active variant
  const activeVariant = variants[selectedVariantIndex];
  const selectedModule: PlacedModule | undefined = activeVariant
    ? [...activeVariant.plan.walls.flatMap((w) => w.modules), ...activeVariant.plan.cornerModules]
        .find((m) => m.id === selectedModuleId)
    : undefined;

  // Reset color when module changes
  useEffect(() => {
    setColor("#6b7280");
  }, [selectedModuleId]);

  if (!selectedModuleId || !selectedModule) {
    return (
      <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/60 p-4 text-center">
        <Box className="size-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">
          Click a module in the 3D viewer to inspect it
        </p>
      </div>
    );
  }

  const handleColorChange = (newColor: string) => {
    setColor(newColor);
    onColorChange(selectedModule.id, newColor);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold tracking-tight font-display">Module Inspector</h3>
        <Button
          variant="ghost"
          size="icon-xs"
          className="rounded-lg"
          onClick={() => setSelectedModuleId(null)}
        >
          <X className="size-3.5" />
        </Button>
      </div>

      <div className="rounded-xl border border-border/60 p-3 space-y-0.5">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-semibold font-mono">{selectedModule.article}</span>
          <Badge variant="outline" className="text-xs capitalize">
            {typeLabel(selectedModule.type)}
          </Badge>
        </div>

        <InfoRow label="Module ID" value={<span className="font-mono text-xs">{selectedModule.id}</span>} />
        <InfoRow label="Cabinet ID" value={selectedModule.cabinetId} />
        <InfoRow
          label="Dimensions"
          value={`${selectedModule.width} x ${selectedModule.height} x ${selectedModule.depth} mm`}
        />
        <InfoRow label="Wall" value={selectedModule.wallId} />
        <InfoRow label="X Offset" value={`${selectedModule.x} mm`} />
      </div>

      <div className="rounded-xl border border-border/60 p-3">
        <div className="flex items-center gap-2 mb-2">
          <Palette className="size-3.5 text-muted-foreground" />
          <span className="text-xs font-medium">Module Color</span>
        </div>
        <div className="flex items-center gap-3">
          <Input
            type="color"
            value={color}
            onChange={(e) => handleColorChange(e.target.value)}
            className="h-8 w-12 cursor-pointer rounded-lg border-border/60 p-0.5"
          />
          <Input
            type="text"
            value={color}
            onChange={(e) => handleColorChange(e.target.value)}
            className="h-8 flex-1 rounded-lg border-border/60 font-mono text-xs"
            placeholder="#000000"
          />
        </div>
      </div>

      <Button
        variant="outline"
        className="w-full rounded-lg"
        onClick={() => setSelectedModuleId(null)}
      >
        <X className="mr-2 size-4" />
        Deselect
      </Button>
    </div>
  );
}
