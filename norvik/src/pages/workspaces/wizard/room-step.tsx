import { usePlannerStore } from "@/stores/planner-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Minus, Plus, RectangleHorizontal, CornerDownRight } from "lucide-react";

function NumberStepper({
  label,
  value,
  onChange,
  step = 100,
  min = 0,
  suffix = "mm",
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  suffix?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0 rounded-lg"
          onClick={() => onChange(Math.max(min, value - step))}
        >
          <Minus className="h-3.5 w-3.5" />
        </Button>
        <div className="relative flex-1 min-w-0">
          <Input
            type="number"
            value={value}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              if (!isNaN(v) && v >= min) onChange(v);
            }}
            className="h-9 pr-9 text-center text-sm font-medium rounded-lg"
          />
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground/70">
            {suffix}
          </span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0 rounded-lg"
          onClick={() => onChange(value + step)}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

const layoutOptions = [
  {
    value: "linear" as const,
    label: "Linear",
    description: "Single wall kitchen",
    icon: RectangleHorizontal,
  },
  {
    value: "l-shaped" as const,
    label: "L-Shaped",
    description: "Two-wall corner kitchen",
    icon: CornerDownRight,
  },
];

export function RoomStep() {
  const { roomWidth, roomDepth, wallHeight, layoutType, lShapedSide, sideWallWidth, setRoomConfig, setLShapedSide, setSideWallWidth } =
    usePlannerStore();

  const maxPreview = 180;
  const allDims = layoutType === "l-shaped"
    ? [roomWidth, roomDepth, sideWallWidth]
    : [roomWidth, roomDepth];
  const scale = maxPreview / Math.max(...allDims);
  const previewW = Math.round(roomWidth * scale);
  const previewD = Math.round(roomDepth * scale);
  const previewSideW = Math.round(sideWallWidth * scale);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="font-display text-lg font-semibold">Room Dimensions</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Set the size of your kitchen space
        </p>
      </div>

      {/* Dimensions — responsive grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <NumberStepper
          label="Room Width"
          value={roomWidth}
          onChange={(v) => setRoomConfig({ roomWidth: v })}
          min={500}
        />
        <NumberStepper
          label="Room Depth"
          value={roomDepth}
          onChange={(v) => setRoomConfig({ roomDepth: v })}
          min={500}
        />
        <NumberStepper
          label="Wall Height"
          value={wallHeight}
          onChange={(v) => setRoomConfig({ wallHeight: v })}
          min={2000}
        />
      </div>

      {/* Layout type + Room preview side by side on desktop */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Layout Type */}
        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground">
            Layout Type
          </Label>
          <div className="grid grid-cols-2 gap-3">
            {layoutOptions.map((opt) => {
              const Icon = opt.icon;
              const selected = layoutType === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRoomConfig({ layoutType: opt.value })}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-center transition-all duration-200",
                    selected
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border/60 hover:border-primary/30",
                  )}
                >
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-lg",
                      selected
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{opt.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {opt.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* L-Shaped options */}
          {layoutType === "l-shaped" && (
            <div className="space-y-3 mt-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">
                  Side Wall Direction
                </Label>
                <div className="flex gap-2">
                  {(["left", "right"] as const).map((side) => (
                    <button
                      key={side}
                      type="button"
                      onClick={() => setLShapedSide(side)}
                      className={cn(
                        "flex-1 rounded-lg border-2 px-3 py-2 text-sm font-medium transition-all",
                        lShapedSide === side
                          ? "border-primary bg-primary/5"
                          : "border-border/60 hover:border-primary/30",
                      )}
                    >
                      {side === "left" ? "Left" : "Right"}
                    </button>
                  ))}
                </div>
              </div>
              <NumberStepper
                label="Side Wall Width"
                value={sideWallWidth}
                onChange={setSideWallWidth}
                min={500}
              />
            </div>
          )}
        </div>

        {/* Room Preview */}
        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground">
            Room Preview
          </Label>
          <div className="flex items-center justify-center rounded-xl border border-border/60 bg-muted/20 p-8">
            <div className="relative">
              <div
                className="rounded-sm border-2 border-primary/50 bg-primary/5"
                style={{ width: previewW, height: previewD }}
              />

              {/* Width label — top */}
              <div className="absolute -top-5 left-0 w-full text-center">
                <span className="text-[11px] font-medium text-muted-foreground">
                  {roomWidth} mm
                </span>
              </div>

              {/* Depth label — right side for linear & l-shaped left, left side for l-shaped right */}
              {layoutType === "l-shaped" && lShapedSide === "right" ? (
                <div
                  className="absolute top-0 flex items-center"
                  style={{ right: previewW + 8, height: previewD }}
                >
                  <span className="text-[11px] font-medium text-muted-foreground whitespace-nowrap">
                    {roomDepth} mm
                  </span>
                </div>
              ) : (
                <div
                  className="absolute top-0 flex items-center"
                  style={{ left: previewW + 8, height: previewD }}
                >
                  <span className="text-[11px] font-medium text-muted-foreground whitespace-nowrap">
                    {roomDepth} mm
                  </span>
                </div>
              )}

              {/* Wall indicators */}
              {layoutType === "linear" ? (
                <div className="absolute -bottom-1 left-0 h-1.5 w-full rounded-full bg-primary" />
              ) : (
                <>
                  {/* Back wall — always at bottom */}
                  <div className="absolute -bottom-1 left-0 h-1.5 w-full rounded-full bg-primary" />
                  {/* Side wall — proportional to sideWallWidth, anchored to bottom */}
                  {lShapedSide === "left" ? (
                    <div
                      className="absolute -left-1 w-1.5 rounded-full bg-primary"
                      style={{ bottom: 0, height: previewSideW }}
                    />
                  ) : (
                    <div
                      className="absolute -right-1 w-1.5 rounded-full bg-primary"
                      style={{ bottom: 0, height: previewSideW }}
                    />
                  )}
                  {/* Side wall width label */}
                  {lShapedSide === "left" ? (
                    <div
                      className="absolute flex items-center"
                      style={{ right: previewW + 8, bottom: 0, height: previewSideW }}
                    >
                      <span className="text-[11px] font-medium text-primary whitespace-nowrap">
                        {sideWallWidth} mm
                      </span>
                    </div>
                  ) : (
                    <div
                      className="absolute flex items-center"
                      style={{ left: previewW + 8, bottom: 0, height: previewSideW }}
                    >
                      <span className="text-[11px] font-medium text-primary whitespace-nowrap">
                        {sideWallWidth} mm
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
