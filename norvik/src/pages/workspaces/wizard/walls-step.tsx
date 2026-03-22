import { useEffect, useMemo, useCallback } from "react";
import { usePlannerStore } from "@/stores/planner-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Plus, Trash2, CookingPot, Droplets, Flame } from "lucide-react";

interface Anchor {
  type: "sink" | "cooktop" | "oven";
  position: number;
  width: number;
}

interface WallConfig {
  id: string;
  length: number;
  anchors: Anchor[];
}

const anchorTypes = [
  { type: "sink" as const, label: "Sink", icon: Droplets },
  { type: "cooktop" as const, label: "Cooktop", icon: Flame },
  { type: "oven" as const, label: "Oven", icon: CookingPot },
];

function getAnchorColor(type: Anchor["type"]) {
  switch (type) {
    case "sink":
      return "bg-blue-500";
    case "cooktop":
      return "bg-orange-500";
    case "oven":
      return "bg-red-500";
  }
}

function getAnchorBorder(type: Anchor["type"]) {
  switch (type) {
    case "sink":
      return "border-blue-400";
    case "cooktop":
      return "border-orange-400";
    case "oven":
      return "border-red-400";
  }
}

function hasOverlap(anchors: Anchor[], index: number): boolean {
  const a = anchors[index];
  const aEnd = a.position + a.width;
  for (let i = 0; i < anchors.length; i++) {
    if (i === index) continue;
    const b = anchors[i];
    const bEnd = b.position + b.width;
    if (a.position < bEnd && aEnd > b.position) return true;
  }
  return false;
}

function isOutOfBounds(anchor: Anchor, wallLength: number): boolean {
  return anchor.position < 0 || anchor.position + anchor.width > wallLength;
}

function WallDiagram({
  wall,
  onUpdateAnchor,
  onRemoveAnchor,
  onAddAnchor,
}: {
  wall: WallConfig;
  onUpdateAnchor: (
    wallId: string,
    anchorIdx: number,
    updates: Partial<Anchor>
  ) => void;
  onRemoveAnchor: (wallId: string, anchorIdx: number) => void;
  onAddAnchor: (wallId: string, type: Anchor["type"]) => void;
}) {
  const barWidth = Math.min(520, typeof window !== "undefined" ? window.innerWidth - 200 : 480);
  const scale = barWidth / wall.length;

  return (
    <div className="space-y-4 rounded-xl border border-border/60 p-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">{wall.id}</h3>
          <p className="text-sm text-muted-foreground">
            Length: {wall.length} mm
          </p>
        </div>
        <div className="flex gap-2">
          {anchorTypes.map(({ type, label, icon: Icon }) => (
            <Button
              key={type}
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => onAddAnchor(wall.id, type)}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </Button>
          ))}
        </div>
      </div>

      {/* Visual wall bar */}
      <div className="overflow-x-auto">
        <div className="relative mx-auto" style={{ width: barWidth }}>
          {/* Wall bar */}
          <div className="h-10 w-full rounded bg-muted/80 border border-border/60" />

          {/* Anchor markers */}
          {wall.anchors.map((anchor, idx) => {
            const left = Math.max(0, anchor.position * scale);
            const width = Math.max(8, anchor.width * scale);
            const overlap = hasOverlap(wall.anchors, idx);
            const outOfBounds = isOutOfBounds(anchor, wall.length);
            const hasError = overlap || outOfBounds;

            return (
              <div
                key={idx}
                className={cn(
                  "absolute top-0 flex h-10 items-center justify-center rounded text-[10px] font-medium text-white transition-all",
                  hasError ? "bg-destructive/80" : getAnchorColor(anchor.type)
                )}
                style={{ left, width }}
                title={`${anchor.type}: ${anchor.position}mm, ${anchor.width}mm wide${hasError ? " (invalid)": ""}`}
              >
                {width > 30 && anchor.type.charAt(0).toUpperCase()}
              </div>
            );
          })}

          {/* Scale ticks */}
          <div className="mt-1 flex justify-between">
            <span className="text-[10px] text-muted-foreground">0</span>
            <span className="text-[10px] text-muted-foreground">
              {wall.length} mm
            </span>
          </div>
        </div>
      </div>

      {/* Anchor detail rows */}
      {wall.anchors.length > 0 && (
        <div className="space-y-3">
          {wall.anchors.map((anchor, idx) => {
            const overlap = hasOverlap(wall.anchors, idx);
            const outOfBounds = isOutOfBounds(anchor, wall.length);
            const AnchorIcon =
              anchorTypes.find((t) => t.type === anchor.type)?.icon ?? Droplets;

            return (
              <div
                key={idx}
                className={cn(
                  "flex flex-wrap items-center gap-3 rounded-lg border p-3",
                  overlap || outOfBounds
                    ? "border-destructive/50 bg-destructive/5"
                    : getAnchorBorder(anchor.type) + " bg-card"
                )}
              >
                <div className="flex items-center gap-2 min-w-[100px]">
                  <AnchorIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium capitalize">
                    {anchor.type}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground whitespace-nowrap">
                    Position
                  </Label>
                  <Input
                    type="number"
                    value={anchor.position}
                    onChange={(e) =>
                      onUpdateAnchor(wall.id, idx, {
                        position: parseInt(e.target.value, 10) || 0,
                      })
                    }
                    className="h-8 w-24 text-center text-sm"
                  />
                  <span className="text-xs text-muted-foreground">mm</span>
                </div>

                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground whitespace-nowrap">
                    Width
                  </Label>
                  <Input
                    type="number"
                    value={anchor.width}
                    onChange={(e) =>
                      onUpdateAnchor(wall.id, idx, {
                        width: parseInt(e.target.value, 10) || 0,
                      })
                    }
                    className="h-8 w-24 text-center text-sm"
                  />
                  <span className="text-xs text-muted-foreground">mm</span>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="ml-auto text-muted-foreground hover:text-destructive"
                  onClick={() => onRemoveAnchor(wall.id, idx)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>

                {overlap && (
                  <p className="w-full text-xs text-destructive">
                    Overlaps with another anchor
                  </p>
                )}
                {outOfBounds && (
                  <p className="w-full text-xs text-destructive">
                    Extends beyond wall bounds
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {wall.anchors.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-2">
          No anchors yet. Add a sink, cooktop, or oven above.
        </p>
      )}
    </div>
  );
}

export function WallsStep() {
  const { roomWidth, roomDepth, layoutType, walls, setWalls } =
    usePlannerStore();

  // Auto-generate walls when room config changes
  const generatedWalls = useMemo<WallConfig[]>(() => {
    const result: WallConfig[] = [
      { id: "Back Wall", length: roomWidth, anchors: [] },
    ];
    if (layoutType === "l-shaped") {
      result.push({ id: "Left Wall", length: roomDepth, anchors: [] });
    }
    return result;
  }, [roomWidth, roomDepth, layoutType]);

  // Sync generated walls with store, preserving existing anchors
  useEffect(() => {
    const merged = generatedWalls.map((gw) => {
      const existing = walls.find((w) => w.id === gw.id);
      return existing
        ? { ...gw, anchors: existing.anchors }
        : gw;
    });
    // Only update if wall structure actually changed
    const wallIds = walls.map((w) => w.id).join(",");
    const mergedIds = merged.map((w) => w.id).join(",");
    const lengthsChanged = merged.some(
      (w) => walls.find((ew) => ew.id === w.id)?.length !== w.length
    );
    if (wallIds !== mergedIds || lengthsChanged) {
      setWalls(merged);
    }
  }, [generatedWalls, setWalls]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAddAnchor = useCallback(
    (wallId: string, type: Anchor["type"]) => {
      const updated = walls.map((w) => {
        if (w.id !== wallId) return w;
        // Place new anchor at end of last anchor, or at 0
        const lastEnd = w.anchors.reduce(
          (max, a) => Math.max(max, a.position + a.width),
          0
        );
        return {
          ...w,
          anchors: [
            ...w.anchors,
            { type, position: lastEnd, width: 600 },
          ],
        };
      });
      setWalls(updated);
    },
    [walls, setWalls]
  );

  const handleUpdateAnchor = useCallback(
    (wallId: string, anchorIdx: number, updates: Partial<Anchor>) => {
      const updated = walls.map((w) => {
        if (w.id !== wallId) return w;
        return {
          ...w,
          anchors: w.anchors.map((a, i) =>
            i === anchorIdx ? { ...a, ...updates } : a
          ),
        };
      });
      setWalls(updated);
    },
    [walls, setWalls]
  );

  const handleRemoveAnchor = useCallback(
    (wallId: string, anchorIdx: number) => {
      const updated = walls.map((w) => {
        if (w.id !== wallId) return w;
        return {
          ...w,
          anchors: w.anchors.filter((_, i) => i !== anchorIdx),
        };
      });
      setWalls(updated);
    },
    [walls, setWalls]
  );

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-lg font-semibold">
          Walls & Anchors
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Configure anchor points for fixed appliances on each wall
        </p>
      </div>

      <div className="space-y-6">
        {walls.map((wall) => (
          <WallDiagram
            key={wall.id}
            wall={wall}
            onUpdateAnchor={handleUpdateAnchor}
            onRemoveAnchor={handleRemoveAnchor}
            onAddAnchor={handleAddAnchor}
          />
        ))}
      </div>
    </div>
  );
}
