import { useCallback, useEffect, useRef } from "react";
import { usePlannerStore } from "@/stores/planner-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Upload, RotateCcw } from "lucide-react";

interface CountertopPanelProps {
  highlighted?: boolean;
}

export default function CountertopPanel({ highlighted }: CountertopPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const countertopColor = usePlannerStore((s) => s.countertopColor);
  const countertopTextureUrl = usePlannerStore((s) => s.countertopTextureUrl);
  const setCountertopColor = usePlannerStore((s) => s.setCountertopColor);
  const setCountertopTextureUrl = usePlannerStore((s) => s.setCountertopTextureUrl);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleColorChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setCountertopColor(e.target.value);
    },
    [setCountertopColor],
  );

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        setCountertopTextureUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    },
    [setCountertopTextureUrl],
  );

  useEffect(() => {
    if (highlighted && panelRef.current) {
      panelRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [highlighted]);

  const handleReset = useCallback(() => {
    setCountertopColor(null);
    setCountertopTextureUrl(null);
  }, [setCountertopColor, setCountertopTextureUrl]);

  return (
    <div
      ref={panelRef}
      className={cn(
        "space-y-4 rounded-2xl border border-border/60 bg-card p-4 shadow-sm transition-shadow duration-300",
        highlighted && "ring-2 ring-primary shadow-md",
      )}
    >
      <h3 className="text-sm font-semibold">Столешница</h3>

      <p className="text-xs text-muted-foreground">
        Выберите цвет или загрузите текстуру
      </p>

      {/* Color picker */}
      <div className="space-y-1.5">
        <Label className="text-xs">Цвет (NCS)</Label>
        <div className="flex items-center gap-2">
          <Input
            type="color"
            value={countertopColor ?? "#8B6914"}
            onChange={handleColorChange}
            className="h-9 w-14 cursor-pointer p-1"
          />
          <span className="text-xs text-muted-foreground">
            {countertopColor ?? "По умолчанию"}
          </span>
        </div>
      </div>

      {/* Texture upload */}
      <div className="space-y-1.5">
        <Label className="text-xs">Текстура</Label>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          className="hidden"
        />
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="h-3.5 w-3.5" />
          {countertopTextureUrl ? "Заменить текстуру" : "Загрузить текстуру"}
        </Button>
        {countertopTextureUrl && (
          <div className="mt-2 rounded border border-border/60 overflow-hidden">
            <img
              src={countertopTextureUrl}
              alt="Текстура столешницы"
              className="h-16 w-full object-cover"
            />
          </div>
        )}
      </div>

      {/* Reset */}
      {(countertopColor || countertopTextureUrl) && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full gap-2 text-muted-foreground"
          onClick={handleReset}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Сбросить
        </Button>
      )}
    </div>
  );
}
