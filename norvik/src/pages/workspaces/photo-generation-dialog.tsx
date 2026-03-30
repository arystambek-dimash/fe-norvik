import {
  ImagePlus,
  Loader2,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PhotoGenerationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prompt: string;
  statusMessage: string | null;
  isGenerating: boolean;
  referenceImageUrl: string | null;
  generatedImageUrl: string | null;
  onPromptChange: (value: string) => void;
  onGenerate: () => void;
  onCancel?: () => void;
}

function ImageFrame({
  title,
  description,
  imageUrl,
  emptyIcon: EmptyIcon,
}: {
  title: string;
  description: string;
  imageUrl: string | null;
  emptyIcon: typeof ImagePlus;
}) {
  return (
    <div className="overflow-hidden rounded-[1.35rem] border border-border/70 bg-background/90 shadow-sm">
      <div className="flex items-center justify-between border-b border-border/60 bg-secondary/40 px-4 py-3">
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>

      <div className="aspect-[5/4] bg-[radial-gradient(circle_at_top,_rgba(164,124,88,0.18),_transparent_58%),linear-gradient(180deg,rgba(255,255,255,0.92),rgba(244,238,230,0.96))]">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-muted-foreground">
            <div className="rounded-full border border-border/60 bg-background/80 p-3 shadow-sm">
              <EmptyIcon className="h-5 w-5" />
            </div>
            <p className="max-w-52 text-sm">{description}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PhotoGenerationDialog({
  open,
  onOpenChange,
  prompt,
  statusMessage,
  isGenerating,
  referenceImageUrl,
  generatedImageUrl,
  onPromptChange,
  onGenerate,
  onCancel,
}: PhotoGenerationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto border-border/70 bg-[linear-gradient(180deg,rgba(255,252,247,0.98),rgba(244,237,228,0.98))] p-0 sm:max-w-5xl">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <div className="border-b border-border/60 p-6 lg:border-r lg:border-b-0 lg:p-7">
            <DialogHeader className="items-start text-left">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="rounded-full bg-primary/95 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-primary-foreground">
                  Photo AI
                </Badge>
                <Badge variant="outline" className="rounded-full">
                  auto-angle capture
                </Badge>
              </div>
              <DialogTitle className="pt-3 text-3xl font-display">
                Фоторендер кухни
              </DialogTitle>
              <DialogDescription className="max-w-md text-sm leading-6">
                Кнопка сама ставит камеру в правильный угол, убирает служебные подписи,
                делает чистый скриншот и отправляет его в Stable Diffusion 3.5 Large.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-6 space-y-5">
              <div className="rounded-[1.35rem] border border-border/70 bg-background/88 p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-primary/12 p-2 text-primary">
                    {isGenerating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Статус генерации</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {statusMessage ||
                        "Готово к запуску. Ракурс подставится автоматически, даже если пользователь сейчас смотрит на сцену неправильно."}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="photo-prompt" className="gap-2">
                  <WandSparkles className="h-4 w-4 text-primary" />
                  Дополнительные пожелания к фото
                </Label>
                <Textarea
                  id="photo-prompt"
                  value={prompt}
                  onChange={(event) => onPromptChange(event.target.value)}
                  placeholder="Например: тёплый дневной свет, белые стены, дорогая интерьерная фотография."
                  className="min-h-28 rounded-2xl bg-background/85"
                />
              </div>
            </div>
          </div>

          <div className="p-6 lg:p-7">
            <div className="space-y-4">
              <ImageFrame
                title="Сервисный кадр"
                description="Этот ракурс программа снимает сама перед отправкой в Replicate."
                imageUrl={referenceImageUrl}
                emptyIcon={ImagePlus}
              />

              <ImageFrame
                title="Готовое фото"
                description="После генерации здесь появится реалистичный рендер вашей кухни."
                imageUrl={generatedImageUrl}
                emptyIcon={Sparkles}
              />

              {generatedImageUrl && (
                <Button asChild variant="outline" className="rounded-xl">
                  <a href={generatedImageUrl} download="kitchen-photo.webp">
                    Скачать фото
                  </a>
                </Button>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="border-t border-border/60 bg-background/80 px-6 py-4 sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Референс отправляется как image-to-image, чтобы сохранить реальную геометрию кухни.
          </p>
          <div className="flex items-center gap-2">
            {isGenerating && onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                className="rounded-xl px-5"
              >
                Отменить
              </Button>
            )}
            <Button
              type="button"
              onClick={onGenerate}
              disabled={isGenerating}
              className="rounded-xl px-5"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Генерируем фото...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  {generatedImageUrl ? "Перегенерировать" : "Сделать фото генерацию"}
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
