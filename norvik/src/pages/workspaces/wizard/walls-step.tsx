import { useEffect, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { usePlannerStore } from "@/stores/planner-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { Plus, Trash2, CookingPot, Droplets, Flame, Refrigerator } from "lucide-react";
import { MAX_COUNTERTOP, CORNER_WALL_OCCUPANCY } from "@/algorithm/constants";
import { snapToGrid } from "@/algorithm/segmenter";
import { CabinetKind, CabinetType } from "@/types/enums";
import type { CabinetRead } from "@/types/entities";

interface Anchor {
  type: "sink" | "cooktop" | "oven";
  position: number;
  width: number;
  glbFile?: string | null;
}

interface SegmentIssue {
  anchorIdx: number;
  side: 'before' | 'after';
  segmentWidth: number;
  suggestions: number[];
}

interface WallConfig {
  id: string;
  length: number;
  anchors: Anchor[];
}

const anchorTypes = [
  { type: "sink" as const, label: "Мойка", icon: Droplets },
  { type: "cooktop" as const, label: "Варочная панель", icon: Flame },
  { type: "oven" as const, label: "Духовой шкаф", icon: CookingPot },
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

function hasInvalidGap(anchors: Anchor[], index: number, drawerHousingWidth: number): boolean {
  const a = anchors[index];
  if (a.type !== "sink" && a.type !== "cooktop") return false;
  const counterType = a.type === "sink" ? "cooktop" : "sink";
  const aEnd = a.position + a.width;
  for (let i = 0; i < anchors.length; i++) {
    if (i === index) continue;
    const b = anchors[i];
    if (b.type !== counterType) continue;
    const bEnd = b.position + b.width;
    // Gap = distance between the two non-overlapping edges
    const gap = Math.max(b.position - aEnd, a.position - bEnd);
    if (gap < 0) continue;
    if (gap < drawerHousingWidth) return true;
    if (gap % 50 !== 0) return true;
  }
  return false;
}

function isInFridgeZone(
  anchor: Anchor,
  wallLength: number,
  fridgeSide?: 'left' | 'right',
  fridgeWidth?: number,
  penalWidth?: number,
): boolean {
  if (!fridgeSide || !fridgeWidth) return false;
  const totalReserve = fridgeWidth + (penalWidth ?? 0);
  const anchorEnd = anchor.position + anchor.width;

  if (fridgeSide === 'left') {
    // Reserved zone: [0, totalReserve]
    return anchor.position < totalReserve && anchorEnd > 0;
  } else {
    // Reserved zone: [wallLength - totalReserve, wallLength]
    const zoneStart = wallLength - totalReserve;
    return anchor.position < wallLength && anchorEnd > zoneStart;
  }
}

function analyzeSegments(wall: WallConfig): SegmentIssue[] {
  const sortedAnchors = [...wall.anchors].sort((a, b) => a.position - b.position);
  const issues: SegmentIssue[] = [];

  let cursor = 0;
  for (let i = 0; i <= sortedAnchors.length; i++) {
    const segEnd = i < sortedAnchors.length ? sortedAnchors[i].position : wall.length;
    const segWidth = segEnd - cursor;

    if (segWidth > 50 && segWidth % 50 !== 0) {
      const anchorIdx = i < sortedAnchors.length ? i : i - 1;
      const side: 'before' | 'after' = i < sortedAnchors.length ? 'before' : 'after';
      const anchor = sortedAnchors[anchorIdx];
      const origIdx = wall.anchors.indexOf(anchor);
      const suggestions: number[] = [];
      const segCursor = side === 'before' ? cursor : anchor.position + anchor.width;

      for (const delta of [-100, -50, 50, 100]) {
        const newPos = anchor.position + delta;
        if (newPos < 0 || newPos + anchor.width > wall.length) continue;
        const hasOv = wall.anchors.some((a, idx) => {
          if (idx === origIdx) return false;
          return newPos < a.position + a.width && newPos + anchor.width > a.position;
        });
        if (hasOv) continue;
        const newSegWidth = side === 'before'
          ? newPos - segCursor
          : wall.length - (newPos + anchor.width);
        if (newSegWidth > 0 && newSegWidth % 50 === 0) {
          suggestions.push(newPos);
        }
      }

      if (suggestions.length > 0) {
        issues.push({ anchorIdx: origIdx, side, segmentWidth: segWidth, suggestions });
      }
    }

    if (i < sortedAnchors.length) {
      cursor = sortedAnchors[i].position + sortedAnchors[i].width;
    }
  }

  return issues;
}

function isInCornerZone(
  anchor: Anchor,
  wallLength: number,
  cornerSide?: 'start' | 'end',
): boolean {
  if (!cornerSide) return false;
  const anchorEnd = anchor.position + anchor.width;
  if (cornerSide === 'start') {
    return anchor.position < CORNER_WALL_OCCUPANCY && anchorEnd > 0;
  } else {
    const zoneStart = wallLength - CORNER_WALL_OCCUPANCY;
    return anchor.position < wallLength && anchorEnd > zoneStart;
  }
}

function WallDiagram({
  wall,
  drawerHousingWidth,
  fridgeSide,
  fridgeWidth,
  penalWidth,
  cornerSide,
  cornerSummary,
  onUpdateAnchor,
  onRemoveAnchor,
  onAddAnchor,
}: {
  wall: WallConfig;
  drawerHousingWidth: number;
  fridgeSide?: 'left' | 'right';
  fridgeWidth?: number;
  penalWidth?: number;
  cornerSide?: 'start' | 'end';
  cornerSummary?: string;
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

  const segmentIssues = useMemo(
    () => analyzeSegments(wall),
    [wall],
  );

  return (
    <div className="space-y-4 rounded-xl border border-border/60 p-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">{wall.id}</h3>
          <p className="text-sm text-muted-foreground">
            Длина: {wall.length} мм
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
            const tooClose = hasInvalidGap(wall.anchors, idx, drawerHousingWidth);
            const inFridgeZone = isInFridgeZone(anchor, wall.length, fridgeSide, fridgeWidth, penalWidth);
            const inCornerZone = isInCornerZone(anchor, wall.length, cornerSide);
            const hasError = overlap || outOfBounds || tooClose || inFridgeZone || inCornerZone;

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

          {/* Fridge + Penal markers */}
          {fridgeSide && fridgeWidth && fridgeWidth > 0 && (() => {
            const pw = penalWidth ?? 0;
            const totalTall = fridgeWidth + pw;
            // Right: [fridge][penal]|wall-end — Left: wall-start|[penal][fridge]
            const fridgeLeft = fridgeSide === 'right'
              ? barWidth - totalTall * scale
              : pw * scale;
            const penalLeft = fridgeSide === 'right'
              ? barWidth - pw * scale
              : 0;

            return (
              <>
                {/* Fridge */}
                <div
                  className="absolute top-0 flex h-10 items-center justify-center rounded bg-emerald-600 text-[10px] font-medium text-white"
                  style={{ left: fridgeLeft, width: Math.max(8, fridgeWidth * scale) }}
                  title={`Холодильник: ${fridgeWidth}мм`}
                >
                  <Refrigerator className="h-4 w-4" />
                </div>
                {/* Penal */}
                {pw > 0 && (
                  <div
                    className="absolute top-0 flex h-10 items-center justify-center rounded bg-amber-600 text-[10px] font-medium text-white"
                    style={{ left: penalLeft, width: Math.max(8, pw * scale) }}
                    title={`Пенал: ${pw}мм`}
                  >
                    П
                  </div>
                )}
              </>
            );
          })()}

          {/* Corner zone marker */}
          {cornerSide && (() => {
            const cornerW = Math.max(8, CORNER_WALL_OCCUPANCY * scale);
            const cornerLeft = cornerSide === 'start' ? 0 : barWidth - cornerW;
            return (
              <div
                className="absolute top-0 flex h-10 items-center justify-center rounded border border-dashed border-violet-400 bg-violet-500/20 text-[10px] font-medium text-violet-700"
                style={{ left: cornerLeft, width: cornerW }}
                title={cornerSummary ?? `Угловая зона одного СУ: ${CORNER_WALL_OCCUPANCY}мм`}
              >
                Угол
              </div>
            );
          })()}

          {/* Scale ticks */}
          <div className="mt-1 flex justify-between">
            <span className="text-[10px] text-muted-foreground">0</span>
            <span className="text-[10px] text-muted-foreground">
              {wall.length} мм
            </span>
          </div>
        </div>
      </div>

      {/* Layout breakdown info */}
      {fridgeSide && fridgeWidth && fridgeWidth > 0 && (
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span>Столешница: <strong className="text-foreground">{wall.length - fridgeWidth - (penalWidth ?? 0)} мм</strong></span>
          <span className="text-emerald-600">Холодильник: <strong>{fridgeWidth} мм</strong></span>
          {(penalWidth ?? 0) > 0 && (
            <span className="text-amber-600">Пенал: <strong>{penalWidth} мм</strong></span>
          )}
          {(penalWidth ?? 0) > 0 && (
            <span className="italic">(пенал добавлен, т.к. стена &gt; {MAX_COUNTERTOP} мм)</span>
          )}
        </div>
      )}

      {/* Anchor detail rows */}
      {wall.anchors.length > 0 && (
        <div className="space-y-3">
          {wall.anchors.map((anchor, idx) => {
            const overlap = hasOverlap(wall.anchors, idx);
            const outOfBounds = isOutOfBounds(anchor, wall.length);
            const tooClose = hasInvalidGap(wall.anchors, idx, drawerHousingWidth);
            const inFridgeZone = isInFridgeZone(anchor, wall.length, fridgeSide, fridgeWidth, penalWidth);
            const inCornerZone = isInCornerZone(anchor, wall.length, cornerSide);
            const AnchorIcon =
              anchorTypes.find((t) => t.type === anchor.type)?.icon ?? Droplets;

            return (
              <div
                key={idx}
                className={cn(
                  "flex flex-wrap items-center gap-3 rounded-lg border p-3",
                  overlap || outOfBounds || tooClose || inFridgeZone || inCornerZone
                    ? "border-destructive/50 bg-destructive/5"
                    : getAnchorBorder(anchor.type) + " bg-card"
                )}
              >
                <div className="flex items-center gap-2 min-w-[100px]">
                  <AnchorIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {anchorTypes.find((t) => t.type === anchor.type)?.label ?? anchor.type}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground whitespace-nowrap">
                    Позиция
                  </Label>
                  <Input
                    type="number"
                    step={50}
                    value={anchor.position}
                    onChange={(e) =>
                      onUpdateAnchor(wall.id, idx, {
                        position: Math.max(0, parseInt(e.target.value, 10) || 0),
                      })
                    }
                    className="h-8 w-24 text-center text-sm"
                  />
                  <span className="text-xs text-muted-foreground">мм</span>
                </div>

                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground whitespace-nowrap">
                    Ширина
                  </Label>
                  <Input
                    type="number"
                    step={50}
                    value={anchor.width}
                    onChange={(e) =>
                      onUpdateAnchor(wall.id, idx, {
                        width: Math.max(50, snapToGrid(parseInt(e.target.value, 10) || 0)),
                      })
                    }
                    className="h-8 w-24 text-center text-sm"
                  />
                  <span className="text-xs text-muted-foreground">мм</span>
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
                    Перекрывается с другой точкой привязки
                  </p>
                )}
                {outOfBounds && (
                  <p className="w-full text-xs text-destructive">
                    Выходит за пределы стены
                  </p>
                )}
                {tooClose && (
                  <p className="w-full text-xs text-destructive">
                    Мин. расстояние между мойкой и варочной — {drawerHousingWidth} мм (кратно 50)
                  </p>
                )}
                {inFridgeZone && (
                  <p className="w-full text-xs text-destructive">
                    Якорь пересекается с зоной холодильника/пенала — переместите якорь за пределы зоны ({fridgeSide === 'left' ? `0–${(fridgeWidth ?? 0) + (penalWidth ?? 0)}` : `${wall.length - (fridgeWidth ?? 0) - (penalWidth ?? 0)}–${wall.length}`} мм)
                  </p>
                )}
                {inCornerZone && (
                  <p className="w-full text-xs text-destructive">
                    Якорь пересекается с угловой зоной одного СУ — переместите якорь за пределы зоны ({cornerSide === 'start' ? `0–${CORNER_WALL_OCCUPANCY}` : `${wall.length - CORNER_WALL_OCCUPANCY}–${wall.length}`} мм)
                  </p>
                )}
                {segmentIssues
                  .filter(issue => issue.anchorIdx === idx)
                  .map((issue, issueIdx) => (
                    <div key={issueIdx} className="w-full space-y-1">
                      <p className="text-xs text-amber-600">
                        ⚠️ Сегмент {issue.segmentWidth}мм ({issue.side === 'before' ? 'слева' : 'справа'} от якоря) — не кратно 50мм, могут появиться пустые места
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {issue.suggestions.map((pos) => (
                          <button
                            key={pos}
                            type="button"
                            onClick={() => onUpdateAnchor(wall.id, idx, { position: pos })}
                            className="text-xs px-2 py-0.5 rounded-md border border-amber-400 text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/20"
                          >
                            → {pos}мм
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            );
          })}
        </div>
      )}

      {wall.anchors.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-2">
          Пока нет точек привязки. Добавьте мойку, варочную панель или духовой шкаф выше.
        </p>
      )}
    </div>
  );
}

function CompactToggle({ label, checked, onChange }: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label className="text-sm">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function CompactSelector<T extends number | string>({ label, options, value, onChange }: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label className="text-sm">{label}</Label>
      <div className="flex gap-0.5 rounded-lg border border-border/60 p-0.5">
        {options.map((w) => (
          <button
            key={w}
            type="button"
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              value === w
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
            )}
            onClick={() => onChange(w)}
          >
            {w}
          </button>
        ))}
      </div>
    </div>
  );
}

export function WallsStep() {
  const { roomWidth, layoutType, lShapedSide, sideWallWidth, walls, setWalls, floorToCeiling, setFloorToCeiling, useSidePanel200, setUseSidePanel200, useHood, setUseHood, useInbuiltStove, setUseInbuiltStove, selectedStoveId, setSelectedStoveId, sinkModuleWidth, setSinkModuleWidth, drawerHousingWidth, setDrawerHousingWidth, fridgeSide, setFridgeSide, selectedLowerCornerCabinetId, setSelectedLowerCornerCabinetId, selectedUpperCornerCabinetId, setSelectedUpperCornerCabinetId, modules } =
    usePlannerStore();

  const lowerCornerOptions = useMemo(
    () => modules.filter((m: CabinetRead) => m.is_corner && m.type === CabinetType.LOWER),
    [modules],
  );

  const upperCornerOptions = useMemo(
    () => modules.filter((m: CabinetRead) => m.is_corner && m.type === CabinetType.UPPER),
    [modules],
  );

  const selectedLowerCornerCabinet = useMemo(
    () => lowerCornerOptions.find((m) => m.id === selectedLowerCornerCabinetId) ?? lowerCornerOptions[0] ?? null,
    [lowerCornerOptions, selectedLowerCornerCabinetId],
  );

  const selectedUpperCornerCabinet = useMemo(
    () => upperCornerOptions.find((m) => m.id === selectedUpperCornerCabinetId) ?? null,
    [upperCornerOptions, selectedUpperCornerCabinetId],
  );

  // Auto-select lower corner + auto-match upper corner by width
  useEffect(() => {
    if (layoutType !== "l-shaped") return;
    if (lowerCornerOptions.length === 0) {
      if (selectedLowerCornerCabinetId !== null) setSelectedLowerCornerCabinetId(null);
      if (selectedUpperCornerCabinetId !== null) setSelectedUpperCornerCabinetId(null);
      return;
    }

    const stillExists = lowerCornerOptions.some((cab) => cab.id === selectedLowerCornerCabinetId);
    if (!stillExists) {
      setSelectedLowerCornerCabinetId(lowerCornerOptions[0].id);
    }

    // Auto-select upper corner matching lower corner width
    const lowerCab = lowerCornerOptions.find((c) => c.id === selectedLowerCornerCabinetId) ?? lowerCornerOptions[0];
    if (lowerCab && upperCornerOptions.length > 0) {
      const matchingUpper = upperCornerOptions.find((c) => c.width === lowerCab.width) ?? upperCornerOptions[0];
      if (matchingUpper && matchingUpper.id !== selectedUpperCornerCabinetId) {
        setSelectedUpperCornerCabinetId(matchingUpper.id);
      }
    } else if (selectedUpperCornerCabinetId !== null) {
      setSelectedUpperCornerCabinetId(null);
    }
  }, [layoutType, lowerCornerOptions, upperCornerOptions, selectedLowerCornerCabinetId, selectedUpperCornerCabinetId, setSelectedLowerCornerCabinetId, setSelectedUpperCornerCabinetId]);

  // Auto-generate walls when room config changes
  const generatedWalls = useMemo<WallConfig[]>(() => {
    const result: WallConfig[] = [
      { id: "Back Wall", length: roomWidth, anchors: [] },
    ];
    if (layoutType === "l-shaped") {
      const sideId = lShapedSide === "left" ? "Left Wall" : "Right Wall";
      result.push({ id: sideId, length: sideWallWidth, anchors: [] });
    }
    return result;
  }, [roomWidth, sideWallWidth, layoutType, lShapedSide]);

  // Sync generated walls with store, preserving existing anchors
  useEffect(() => {
    // Read walls directly from store to avoid stale closure
    const currentWalls = usePlannerStore.getState().walls;
    const merged = generatedWalls.map((gw) => {
      const existing = currentWalls.find((w) => w.id === gw.id);
      return existing
        ? { ...gw, anchors: existing.anchors }
        : gw;
    });
    // Only update if wall structure actually changed
    const wallIds = currentWalls.map((w) => w.id).join(",");
    const mergedIds = merged.map((w) => w.id).join(",");
    const lengthsChanged = merged.some(
      (w) => currentWalls.find((ew) => ew.id === w.id)?.length !== w.length
    );
    if (wallIds !== mergedIds || lengthsChanged) {
      setWalls(merged);
    }
  }, [generatedWalls, setWalls]);

  // Compute fridge/penal reserved zone — wall-aware for L-shaped
  const fridgeZone = useMemo(() => {
    const fridgeCab = modules.find((m: any) => m.kind === CabinetKind.FRIDGE);
    const penalCab = modules.find((m: any) => m.kind === CabinetKind.PENAL);
    if (!fridgeCab || walls.length === 0) return null;

    let fridgeWall: WallConfig;
    let localFridgeSide: 'left' | 'right';

    if (layoutType === 'l-shaped' && walls.length >= 2) {
      // Match algorithm: left → wall1 (back wall) at start, right → wall2 (side wall) at end
      if (fridgeSide === 'left') {
        fridgeWall = walls[0];
        localFridgeSide = 'left';
      } else {
        fridgeWall = walls[1];
        localFridgeSide = 'right';
      }
    } else {
      // Linear: single wall, use fridgeSide as-is
      fridgeWall = walls[walls.length - 1];
      localFridgeSide = fridgeSide;
    }

    const fw = fridgeCab.width;
    const tallZone = Math.max(0, fridgeWall.length - MAX_COUNTERTOP);
    const pw = (penalCab && tallZone >= fw + penalCab.width) ? penalCab.width : 0;
    const total = fw + pw;

    return {
      wallId: fridgeWall.id,
      side: localFridgeSide,
      total,
      fridgeWidth: fw,
      penalWidth: pw,
      start: localFridgeSide === 'left' ? 0 : fridgeWall.length - total,
      end: localFridgeSide === 'left' ? total : fridgeWall.length,
    };
  }, [walls, modules, fridgeSide, layoutType]);

  // Corner zone for L-shaped: back wall start/end depends on selected side
  const cornerZone = useMemo(() => {
    if (layoutType !== 'l-shaped' || walls.length < 2) return null;
    const wall1Side: 'start' | 'end' = lShapedSide === 'left' ? 'start' : 'end';
    const occupancy = selectedLowerCornerCabinet?.width ?? CORNER_WALL_OCCUPANCY;
    return {
      wall1Id: walls[0].id,
      wall1Side,
      wall2Id: walls[1].id,
      wall2Side: 'start' as const,
      occupancy,
    };
  }, [layoutType, walls, lShapedSide, selectedLowerCornerCabinet]);

  const cornerSummary = useMemo(() => {
    if (!cornerZone || walls.length < 2) return null;
    const backWallEdge = cornerZone.wall1Side === 'start' ? 'в начале Back Wall' : 'в конце Back Wall';
    const lowerLabel = selectedLowerCornerCabinet
      ? `${selectedLowerCornerCabinet.article} (${selectedLowerCornerCabinet.width} мм)`
      : `не выбран, используется резерв ${cornerZone.occupancy} мм`;
    const upperLabel = selectedUpperCornerCabinet
      ? `${selectedUpperCornerCabinet.article} (${selectedUpperCornerCabinet.width} мм)`
      : "не выбран";
    return `Нижний угловой модуль: ${lowerLabel}. Верхний угловой модуль: ${upperLabel}. Нижний СУ занимает по ${cornerZone.occupancy} мм на обеих стенах: ${backWallEdge} и в начале ${walls[1].id}.`;
  }, [cornerZone, walls, selectedLowerCornerCabinet, selectedUpperCornerCabinet]);

  /** Snap anchor position out of fridge/penal zone if it overlaps */
  const snapOutOfFridgeZone = useCallback(
    (wallId: string, position: number, width: number): number => {
      if (!fridgeZone || wallId !== fridgeZone.wallId) return position;
      const anchorEnd = position + width;
      if (position < fridgeZone.end && anchorEnd > fridgeZone.start) {
        // Overlaps — snap to the nearest edge
        const snapped = fridgeZone.side === 'left' ? fridgeZone.end : Math.max(0, fridgeZone.start - width);
        toast.info(
          `Якорь сдвинут из зоны холодильника/пенала (${fridgeZone.start}–${fridgeZone.end} мм)`,
        );
        return snapToGrid(snapped);
      }
      return position;
    },
    [fridgeZone],
  );

  /** Snap anchor position out of corner zone if it overlaps */
  const snapOutOfCornerZone = useCallback(
    (wallId: string, position: number, width: number): number => {
      if (!cornerZone) return position;
      const anchorEnd = position + width;
      if (wallId === cornerZone.wall1Id) {
        const wall1 = walls.find((w) => w.id === cornerZone.wall1Id);
        if (!wall1) return position;
        if (cornerZone.wall1Side === 'start') {
          if (position < cornerZone.occupancy && anchorEnd > 0) {
            toast.info(`Якорь сдвинут из угловой зоны (0–${cornerZone.occupancy} мм)`);
            return snapToGrid(cornerZone.occupancy);
          }
          return position;
        }

        // Corner at end of back wall
        const zoneStart = wall1.length - cornerZone.occupancy;
        if (position < wall1.length && anchorEnd > zoneStart) {
          toast.info(`Якорь сдвинут из угловой зоны (${zoneStart}–${wall1.length} мм)`);
          return snapToGrid(Math.max(0, zoneStart - width));
        }
      } else if (wallId === cornerZone.wall2Id) {
        if (cornerZone.wall2Side === 'start' && position < cornerZone.occupancy && anchorEnd > 0) {
          toast.info(`Якорь сдвинут из угловой зоны (0–${cornerZone.occupancy} мм)`);
          return snapToGrid(cornerZone.occupancy);
        }
      }
      return position;
    },
    [cornerZone, walls],
  );

  // When sink module width changes, update all existing sink anchor widths
  const handleSinkModuleWidthChange = useCallback(
    (newWidth: 600 | 800) => {
      setSinkModuleWidth(newWidth);
      const updated = walls.map((w) => ({
        ...w,
        anchors: w.anchors.map((a) =>
          a.type === "sink" ? { ...a, width: newWidth } : a,
        ),
      }));
      setWalls(updated);
    },
    [walls, setWalls, setSinkModuleWidth],
  );

  // List of standalone (non-inbuilt) stoves from catalog
  const standaloneStoves = useMemo(
    () => modules.filter((m: any) => m.kind === CabinetKind.PLATE && !m.inbuilt),
    [modules],
  );

  // Resolve current stove width for cooktop anchors
  const currentCooktopWidth = useMemo(() => {
    if (useInbuiltStove) {
      const inbuiltPlate = modules.find(
        (m: any) => m.kind === CabinetKind.PLATE && m.inbuilt,
      );
      return inbuiltPlate ? inbuiltPlate.width : 600;
    }
    if (selectedStoveId != null) {
      const stove = standaloneStoves.find((m: any) => m.id === selectedStoveId);
      if (stove) return stove.width;
    }
    return standaloneStoves.length > 0 ? standaloneStoves[0].width : 500;
  }, [useInbuiltStove, selectedStoveId, standaloneStoves, modules]);

  // When inbuilt stove toggle changes, update all existing cooktop anchor widths
  const handleInbuiltStoveChange = useCallback(
    (v: boolean) => {
      setUseInbuiltStove(v);
      if (v) {
        setSelectedStoveId(null);
        const inbuiltPlate = modules.find(
          (m: any) => m.kind === CabinetKind.PLATE && m.inbuilt,
        );
        const newWidth = inbuiltPlate ? inbuiltPlate.width : 600;
        const updated = walls.map((w) => ({
          ...w,
          anchors: w.anchors.map((a) =>
            a.type === "cooktop" ? { ...a, width: newWidth } : a,
          ),
        }));
        setWalls(updated);
      } else {
        // Auto-select first standalone stove
        const first = standaloneStoves[0];
        if (first) {
          setSelectedStoveId(first.id);
          const updated = walls.map((w) => ({
            ...w,
            anchors: w.anchors.map((a) =>
              a.type === "cooktop" ? { ...a, width: first.width } : a,
            ),
          }));
          setWalls(updated);
        }
      }
    },
    [walls, setWalls, setUseInbuiltStove, setSelectedStoveId, modules, standaloneStoves],
  );

  // When user selects a specific standalone stove
  const handleStoveSelect = useCallback(
    (stoveId: number) => {
      setSelectedStoveId(stoveId);
      const stove = standaloneStoves.find((m: any) => m.id === stoveId);
      if (!stove) return;
      const updated = walls.map((w) => ({
        ...w,
        anchors: w.anchors.map((a) =>
          a.type === "cooktop" ? { ...a, width: stove.width } : a,
        ),
      }));
      setWalls(updated);
    },
    [walls, setWalls, setSelectedStoveId, standaloneStoves],
  );

  const handleAddAnchor = useCallback(
    (wallId: string, type: Anchor["type"]) => {
      const updated = walls.map((w) => {
        if (w.id !== wallId) return w;
        // Place new anchor at end of last anchor (snapped to 50mm grid), or at 0
        const lastEnd = w.anchors.reduce(
          (max, a) => Math.max(max, a.position + a.width),
          0
        );
        const width = type === "sink" ? sinkModuleWidth : type === "cooktop" ? currentCooktopWidth : 600;
        let snappedPosition = snapOutOfFridgeZone(wallId, snapToGrid(lastEnd), width);
        snappedPosition = snapOutOfCornerZone(wallId, snappedPosition, width);
        return {
          ...w,
          anchors: [
            ...w.anchors,
            { type, position: snappedPosition, width },
          ],
        };
      });
      setWalls(updated);
    },
    [walls, setWalls, sinkModuleWidth, currentCooktopWidth, snapOutOfFridgeZone, snapOutOfCornerZone]
  );

  const handleUpdateAnchor = useCallback(
    (wallId: string, anchorIdx: number, updates: Partial<Anchor>) => {
      const updated = walls.map((w) => {
        if (w.id !== wallId) return w;
        return {
          ...w,
          anchors: w.anchors.map((a, i) => {
            if (i !== anchorIdx) return a;
            const merged = { ...a, ...updates };
            // Auto-snap position out of fridge/penal and corner zones
            if (updates.position !== undefined) {
              merged.position = snapOutOfFridgeZone(wallId, merged.position, merged.width);
              merged.position = snapOutOfCornerZone(wallId, merged.position, merged.width);
            }
            return merged;
          }),
        };
      });
      setWalls(updated);
    },
    [walls, setWalls, snapOutOfFridgeZone, snapOutOfCornerZone]
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
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-lg font-semibold">
          Стены и точки привязки
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Настройте точки привязки для стационарной техники на каждой стене
        </p>
      </div>

      {/* Compact settings grid */}
      <div className="rounded-xl border border-border/60 p-4">
        <div className="grid grid-cols-2 gap-x-8 gap-y-3">
          <CompactToggle label="До потолка" checked={floorToCeiling} onChange={setFloorToCeiling} />
          <CompactToggle label="СБ 200" checked={useSidePanel200} onChange={setUseSidePanel200} />
          <CompactToggle label="Вытяжка" checked={useHood} onChange={setUseHood} />
          <CompactToggle label="Встроенная плита" checked={useInbuiltStove} onChange={handleInbuiltStoveChange} />
          <CompactSelector label="Мойка" options={[600, 800] as const} value={sinkModuleWidth} onChange={handleSinkModuleWidthChange} />
          <CompactSelector label="СЯШ" options={[400, 600] as const} value={drawerHousingWidth} onChange={setDrawerHousingWidth} />
          <CompactSelector
            label="Холодильник"
            options={['Слева', 'Справа'] as const}
            value={fridgeSide === 'left' ? 'Слева' : 'Справа'}
            onChange={(v) => setFridgeSide(v === 'Слева' ? 'left' : 'right')}
          />
        </div>

        {/* Standalone stove selection */}
        {!useInbuiltStove && standaloneStoves.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border/40">
            <Label className="text-xs text-muted-foreground mb-2 block">Выберите плиту</Label>
            <div className="flex flex-wrap gap-1.5">
              {standaloneStoves.map((stove: any) => (
                <button
                  key={stove.id}
                  type="button"
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                    selectedStoveId === stove.id
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : "border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted/60",
                  )}
                  onClick={() => handleStoveSelect(stove.id)}
                >
                  {stove.article} — {stove.width}мм
                </button>
              ))}
            </div>
          </div>
        )}

        {!useInbuiltStove && modules.length > 0 && standaloneStoves.length === 0 && (
          <p className="mt-3 pt-3 border-t border-border/40 text-xs text-muted-foreground">
            Нет отдельностоящих плит в каталоге
          </p>
        )}

        {layoutType === "l-shaped" && (
          <div className="mt-3 space-y-3 border-t border-border/40 pt-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Угловой модуль (СУ)</Label>
              <Select
                value={selectedLowerCornerCabinet ? String(selectedLowerCornerCabinet.id) : "__none__"}
                onValueChange={(value) =>
                  setSelectedLowerCornerCabinetId(value === "__none__" ? null : Number(value))
                }
              >
                <SelectTrigger className="rounded-lg">
                  <SelectValue placeholder="Выберите СУ" />
                </SelectTrigger>
                <SelectContent>
                  {lowerCornerOptions.length === 0 ? (
                    <SelectItem value="__none__">Нет СУ в каталоге</SelectItem>
                  ) : (
                    lowerCornerOptions.map((cab) => (
                      <SelectItem key={cab.id} value={String(cab.id)}>
                        {cab.article} · {cab.width}x{cab.height}x{cab.depth} мм
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {lowerCornerOptions.length === 0 && (
              <p className="text-xs text-muted-foreground">
                В текущем каталоге нет угловых модулей (is_corner=true).
              </p>
            )}
          </div>
        )}
      </div>

      <div className="space-y-6">
        {cornerSummary && (
          <div className="rounded-xl border border-violet-200 bg-violet-50/70 px-4 py-3 text-sm text-violet-900">
            {cornerSummary}
          </div>
        )}

        {walls.map((wall) => {
          // Determine if this wall has the fridge
          const hasFridge = fridgeZone && wall.id === fridgeZone.wallId;
          const wallFridgeSide = hasFridge ? fridgeZone.side : undefined;
          const wallFridgeWidth = hasFridge ? fridgeZone.fridgeWidth : undefined;
          const wallPenalWidth = hasFridge ? fridgeZone.penalWidth : 0;

          // Determine corner side for this wall
          let wallCornerSide: 'start' | 'end' | undefined;
          if (cornerZone) {
            if (wall.id === cornerZone.wall1Id) wallCornerSide = cornerZone.wall1Side;
            else if (wall.id === cornerZone.wall2Id) wallCornerSide = cornerZone.wall2Side;
          }

          return (
            <WallDiagram
              key={wall.id}
              wall={wall}
              drawerHousingWidth={drawerHousingWidth}
              fridgeSide={wallFridgeSide}
              fridgeWidth={wallFridgeWidth}
              penalWidth={wallPenalWidth}
              cornerSide={wallCornerSide}
              cornerSummary={cornerSummary ?? undefined}
              onUpdateAnchor={handleUpdateAnchor}
              onRemoveAnchor={handleRemoveAnchor}
              onAddAnchor={handleAddAnchor}
            />
          );
        })}
      </div>
    </div>
  );
}
