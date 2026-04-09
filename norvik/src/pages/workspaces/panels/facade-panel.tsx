import { useCallback, useRef } from "react";
import { usePlannerStore } from "@/stores/planner-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, RotateCcw } from "lucide-react";

export default function FacadePanel() {
  const facadeColor = usePlannerStore((s) => s.facadeColor);
  const facadeTextureUrl = usePlannerStore((s) => s.facadeTextureUrl);
  const setFacadeColor = usePlannerStore((s) => s.setFacadeColor);
  const setFacadeTextureUrl = usePlannerStore((s) => s.setFacadeTextureUrl);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleColorChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFacadeColor(e.target.value);
    },
    [setFacadeColor],
  );

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        setFacadeTextureUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    },
    [setFacadeTextureUrl],
  );

  const handleReset = useCallback(() => {
    setFacadeColor(null);
    setFacadeTextureUrl(null);
  }, [setFacadeColor, setFacadeTextureUrl]);

  return (
    <div className="space-y-4 rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
      <h3 className="text-sm font-semibold">Фасады</h3>

      <p className="text-xs text-muted-foreground">
        Выберите цвет или загрузите текстуру
      </p>

      {/* Color picker */}
      <div className="space-y-1.5">
        <Label className="text-xs">Цвет (NCS)</Label>
        <div className="flex items-center gap-2">
          <Input
            type="color"
            value={facadeColor ?? "#FFFFFF"}
            onChange={handleColorChange}
            className="h-9 w-14 cursor-pointer p-1"
          />
          <span className="text-xs text-muted-foreground">
            {facadeColor ?? "По умолчанию"}
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
          {facadeTextureUrl ? "Заменить текстуру" : "Загрузить текстуру"}
        </Button>
        {facadeTextureUrl && (
          <div className="mt-2 rounded border border-border/60 overflow-hidden">
            <img
              src={facadeTextureUrl}
              alt="Текстура фасадов"
              className="h-16 w-full object-cover"
            />
          </div>
        )}
      </div>

      {/* Reset */}
      {(facadeColor || facadeTextureUrl) && (
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
