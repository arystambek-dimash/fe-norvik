import { useEffect, useCallback, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { workspacesApi } from "@/api/workspaces";
import {
  buildKitchenPhotoPrompt,
  generateKitchenPhoto,
  prepareReferenceImageForReplicate,
} from "@/api/replicate";
import { usePlannerStore } from "@/stores/planner-store";
import { serializeState, deserializeState } from "@/stores/planner-serialization";
import { PlannerWizard } from "@/pages/workspaces/wizard/wizard-layout";
import VariantPanel from "@/pages/workspaces/panels/variant-panel";
import ModulePanel from "@/pages/workspaces/panels/module-panel";
import CountertopPanel from "@/pages/workspaces/panels/countertop-panel";
import FacadePanel from "@/pages/workspaces/panels/facade-panel";
import GoldenTablePanel from "@/pages/workspaces/panels/golden-table-panel";
import { KitchenViewer } from "@/components/viewer3d";
import type { KitchenViewerHandle } from "@/components/viewer3d";
import { planKitchen } from "@/algorithm";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import PhotoGenerationDialog from "@/pages/workspaces/photo-generation-dialog";
import { ArrowLeft, Save, Loader2, PenTool, Sparkles } from "lucide-react";
import type { KitchenPlan } from "@/algorithm/types";
import type { KitchenStoreState } from "@/algorithm/derive-input";
import { deriveInput } from "@/algorithm";
import type { SolverVariant } from "@/algorithm/types";
import type { WallAnchors } from "@/components/viewer3d/scene-builder";
import { ANCHOR_TO_KIND, buildAnchorGlbByKindMap } from "@/algorithm/constants";

export default function WorkspaceEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const workspaceId = Number(id);
  const viewerRef = useRef<KitchenViewerHandle | null>(null);
  const generatedPhotoUrlRef = useRef<string | null>(null);
  const photoAbortRef = useRef<AbortController | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [countertopSelected, setCountertopSelected] = useState(false);
  const [photoDialogOpen, setPhotoDialogOpen] = useState(false);
  const [isPhotoGenerating, setIsPhotoGenerating] = useState(false);
  const [photoPrompt, setPhotoPrompt] = useState(
    "Тёплый естественный свет, дорогая интерьерная съёмка, максимально реалистичные материалы и текстуры.",
  );
  const [photoStatusMessage, setPhotoStatusMessage] = useState<string | null>(null);
  const [referencePreviewUrl, setReferencePreviewUrl] = useState<string | null>(null);
  const [generatedPhotoUrl, setGeneratedPhotoUrl] = useState<string | null>(null);

  // ---- Planner store selectors ----
  const roomWidth = usePlannerStore((s) => s.roomWidth);
  const roomDepth = usePlannerStore((s) => s.roomDepth);
  const wallHeight = usePlannerStore((s) => s.wallHeight);
  const layoutType = usePlannerStore((s) => s.layoutType);
  const walls = usePlannerStore((s) => s.walls);
  const variants = usePlannerStore((s) => s.variants) as SolverVariant[];
  const selectedVariantIndex = usePlannerStore((s) => s.selectedVariantIndex);
  const selectedModuleId = usePlannerStore((s) => s.selectedModuleId);
  const setVariants = usePlannerStore((s) => s.setVariants);
  const modules = usePlannerStore((s) => s.modules);
  const lShapedSide = usePlannerStore((s) => s.lShapedSide);
  const fridgeSide = usePlannerStore((s) => s.fridgeSide);
  const useInbuiltStove = usePlannerStore((s) => s.useInbuiltStove);
  const selectedStoveId = usePlannerStore((s) => s.selectedStoveId);
  const countertopColor = usePlannerStore((s) => s.countertopColor);
  const countertopTextureUrl = usePlannerStore((s) => s.countertopTextureUrl);
  const facadeColor = usePlannerStore((s) => s.facadeColor);
  const facadeTextureUrl = usePlannerStore((s) => s.facadeTextureUrl);
  const setSelectedModuleId = usePlannerStore((s) => s.setSelectedModuleId);
  const reset = usePlannerStore((s) => s.reset);

  // ---- Fetch workspace ----
  const { data: workspace, isLoading } = useQuery({
    queryKey: ["workspaces", workspaceId],
    queryFn: () => workspacesApi.getById(workspaceId),
    enabled: !isNaN(workspaceId),
  });

  // ---- Initialize store from workspace.content on load ----
  useEffect(() => {
    if (workspace?.content && typeof workspace.content === "object") {
      const restored = deserializeState(workspace.content);
      const store = usePlannerStore.getState();
      store.setRoomConfig({
        roomWidth: restored.roomWidth,
        roomDepth: restored.roomDepth,
        wallHeight: restored.wallHeight,
        layoutType: restored.layoutType,
        lShapedSide: restored.lShapedSide,
        sideWallWidth: restored.sideWallWidth,
      });
      if (restored.walls) store.setWalls(restored.walls);
      if (restored.selectedCatalogId !== undefined)
        store.setSelectedCatalogId(restored.selectedCatalogId);
      if (restored.goldenRules) store.setGoldenRules(restored.goldenRules);
      if (restored.floorToCeiling !== undefined)
        store.setFloorToCeiling(restored.floorToCeiling);
      if (restored.useSidePanel200 !== undefined)
        store.setUseSidePanel200(restored.useSidePanel200);
      if (restored.useHood !== undefined)
        store.setUseHood(restored.useHood);
      if (restored.sinkModuleWidth !== undefined)
        store.setSinkModuleWidth(restored.sinkModuleWidth);
      if (restored.drawerHousingWidth !== undefined)
        store.setDrawerHousingWidth(restored.drawerHousingWidth);
      if (restored.fridgeSide !== undefined)
        store.setFridgeSide(restored.fridgeSide);
      if (restored.useInbuiltStove !== undefined)
        store.setUseInbuiltStove(restored.useInbuiltStove);
      if (restored.selectedStoveId !== undefined)
        store.setSelectedStoveId(restored.selectedStoveId);
      usePlannerStore.setState({
        countertopColor: restored.countertopColor ?? null,
        countertopTextureUrl: restored.countertopTextureUrl ?? null,
        facadeColor: restored.facadeColor ?? null,
        facadeTextureUrl: restored.facadeTextureUrl ?? null,
      });
      if (restored.variants) store.setVariants(restored.variants);
      if (restored.selectedVariantIndex !== undefined)
        store.setSelectedVariantIndex(restored.selectedVariantIndex);
    }
  }, [workspace]);

  // ---- Reset store on unmount ----
  useEffect(() => {
    return () => {
      reset();
    };
  }, [reset]);

  useEffect(() => {
    return () => {
      if (generatedPhotoUrlRef.current) {
        URL.revokeObjectURL(generatedPhotoUrlRef.current);
      }
    };
  }, []);

  // ---- Save mutation ----
  const saveMutation = useMutation({
    mutationFn: (content: Record<string, unknown>) =>
      workspacesApi.update(workspaceId, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      queryClient.invalidateQueries({ queryKey: ["workspaces", workspaceId] });
      toast.success("Workspace saved");
    },
    onError: (err) => {
      console.error("Save workspace error:", err);
      const msg = (err as any)?.response?.data?.detail || "Failed to save workspace";
      toast.error(msg);
    },
  });

  const handleSave = useCallback(() => {
    const state = usePlannerStore.getState();
    const content = serializeState({
      roomWidth: state.roomWidth,
      roomDepth: state.roomDepth,
      wallHeight: state.wallHeight,
      layoutType: state.layoutType,
      lShapedSide: state.lShapedSide,
      sideWallWidth: state.sideWallWidth,
      walls: state.walls,
      selectedCatalogId: state.selectedCatalogId,
      goldenRules: state.goldenRules,
      floorToCeiling: state.floorToCeiling,
      useSidePanel200: state.useSidePanel200,
      useHood: state.useHood,
      useInbuiltStove: state.useInbuiltStove,
      selectedStoveId: state.selectedStoveId,
      sinkModuleWidth: state.sinkModuleWidth,
      drawerHousingWidth: state.drawerHousingWidth,
      fridgeSide: state.fridgeSide,
      countertopColor: state.countertopColor,
      countertopTextureUrl: state.countertopTextureUrl,
      facadeColor: state.facadeColor,
      facadeTextureUrl: state.facadeTextureUrl,
      variants: state.variants,
      selectedVariantIndex: state.selectedVariantIndex,
    });
    saveMutation.mutate(content);
  }, [saveMutation]);

  // ---- Generate plan ----
  const handleGenerate = useCallback(() => {
    setIsGenerating(true);
    setTimeout(() => {
      try {
        const state = usePlannerStore.getState();
        const anchorsMap: Record<string, typeof state.walls[0]["anchors"]> = {};
        for (const wall of state.walls) {
          anchorsMap[wall.id] = wall.anchors;
        }

        const storeState: KitchenStoreState = {
          roomWidth: state.roomWidth,
          roomDepth: state.roomDepth,
          wallHeight: state.wallHeight,
          layoutType: state.layoutType,
          walls: state.walls.map((w) => ({ ...w, anchors: [] })),
          anchors: anchorsMap,
          availableCabinets: state.modules,
          goldenRules: state.goldenRules,
          floorToCeiling: state.floorToCeiling,
          useSidePanel200: state.useSidePanel200,
          useHood: state.useHood,
          useInbuiltStove: state.useInbuiltStove,
          selectedStoveId: state.selectedStoveId,
          sinkModuleWidth: state.sinkModuleWidth,
          drawerHousingWidth: state.drawerHousingWidth,
          fridgeSide: state.fridgeSide,
        };

        const input = deriveInput(storeState);
        const result = planKitchen(input);
        state.setVariants(result);
        toast.success(
          `Generated ${result.length} variant${result.length !== 1 ? "s" : ""}`,
        );
      } catch (err) {
        console.error("Plan generation failed:", err);
        toast.error("Failed to generate kitchen plan");
      } finally {
        setIsGenerating(false);
      }
    }, 0);
  }, []);

  // ---- Derived values ----
  const hasVariants = variants.length > 0;

  const activePlan: KitchenPlan | null = useMemo(() => {
    const variant = variants[selectedVariantIndex] as SolverVariant | undefined;
    return variant?.plan ?? null;
  }, [variants, selectedVariantIndex]);

  const roomConfig = useMemo(
    () => ({ roomWidth, roomDepth, wallHeight, lShapedSide }),
    [roomWidth, roomDepth, wallHeight, lShapedSide],
  );

  const wallAnchors: WallAnchors[] = useMemo(() => {
    const glbByKind = buildAnchorGlbByKindMap(modules, useInbuiltStove, selectedStoveId);

    // Anchor positions are absolute wall coordinates — no shift needed.
    // Auto-snap in walls-step ensures they don't overlap with fridge/penal zone.
    return walls.map((w) => ({
      wallId: w.id,
      anchors: w.anchors.map((a) => {
        if (a.glbFile) return a;
        const glb = glbByKind.get(ANCHOR_TO_KIND[a.type]);
        return glb ? { ...a, glbFile: glb } : a;
      }),
    }));
  }, [walls, modules, useInbuiltStove, selectedStoveId]);

  const handleSelectCountertop = useCallback(() => {
    setCountertopSelected(true);
  }, []);

  const handleSelectModule = useCallback(
    (id: string | null) => {
      setSelectedModuleId(id);
      setCountertopSelected(false);
    },
    [setSelectedModuleId],
  );

  // Allow returning to wizard from planner mode
  const handleEditWizard = useCallback(() => {
    setVariants([]);
  }, [setVariants]);

  const handleCancelPhoto = useCallback(() => {
    photoAbortRef.current?.abort();
    photoAbortRef.current = null;
  }, []);

  const handleGeneratePhoto = useCallback(async () => {
    if (!activePlan) {
      toast.error("Сначала соберите вариант кухни, потом запускайте фото генерацию.");
      return;
    }

    const viewer = viewerRef.current;
    if (!viewer) {
      toast.error("3D viewer ещё не готов к съёмке.");
      return;
    }

    // Cancel any in-flight generation
    photoAbortRef.current?.abort();
    const abortController = new AbortController();
    photoAbortRef.current = abortController;

    setPhotoDialogOpen(true);
    setIsPhotoGenerating(true);
    setPhotoStatusMessage("Выставляем камеру в правильный угол и снимаем чистый референс...");

    try {
      const referenceImage = await viewer.captureReferenceImage();
      setReferencePreviewUrl(referenceImage);

      setPhotoStatusMessage("Оптимизируем снимок для Replicate...");
      const optimizedReferenceImage = await prepareReferenceImageForReplicate(referenceImage);
      setReferencePreviewUrl(optimizedReferenceImage);

      const photoUrl = await generateKitchenPhoto({
        imageDataUrl: optimizedReferenceImage,
        prompt: buildKitchenPhotoPrompt(photoPrompt),
        signal: abortController.signal,
        onStatusChange: setPhotoStatusMessage,
      });

      if (generatedPhotoUrlRef.current) {
        URL.revokeObjectURL(generatedPhotoUrlRef.current);
      }

      generatedPhotoUrlRef.current = photoUrl;
      setGeneratedPhotoUrl(photoUrl);
      setPhotoStatusMessage("Фото готово. Можно скачать или сгенерировать заново.");
      toast.success("Реалистичное фото кухни готово.");
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setPhotoStatusMessage("Генерация отменена.");
        return;
      }
      console.error("Photo generation failed:", err);
      const msg = err instanceof Error ? err.message : "Не удалось сделать фото генерацию.";
      setPhotoStatusMessage(msg);
      toast.error(msg);
    } finally {
      setIsPhotoGenerating(false);
      if (photoAbortRef.current === abortController) {
        photoAbortRef.current = null;
      }
    }
  }, [activePlan, photoPrompt]);

  // ---- Loading ----
  if (isLoading) {
    return (
      <div className="flex h-screen flex-col gap-4 p-6">
        <Skeleton className="h-14 w-full rounded-2xl" />
        <Skeleton className="h-full flex-1 rounded-2xl" />
      </div>
    );
  }

  // ---- Not found ----
  if (!workspace) {
    return (
      <div className="flex h-screen items-center justify-center bg-cream/30">
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-border/60 bg-background p-8 shadow-sm">
          <p className="text-muted-foreground">Workspace not found</p>
          <Button
            variant="outline"
            className="rounded-xl"
            onClick={() => navigate("/workspaces")}
          >
            Back to Workspaces
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-cream/20">
      {/* ---- Top bar ---- */}
      <header className="flex items-center gap-3 border-b bg-background px-4 py-2.5 shadow-sm animate-fade-up">
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 rounded-xl"
          asChild
        >
          <Link to="/workspaces">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>

        <div className="flex-1 min-w-0">
          <h1 className="truncate text-sm font-semibold font-display">
            Workspace #{workspace.id}
          </h1>
          <p className="truncate text-xs text-muted-foreground">
            {roomWidth} &times; {roomDepth} mm &middot;{" "}
            <span className="capitalize">{layoutType}</span>
          </p>
        </div>

        {hasVariants && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 rounded-xl text-xs"
            onClick={handleEditWizard}
          >
            <PenTool className="h-3.5 w-3.5" />
            Edit Setup
          </Button>
        )}

        {hasVariants && (
          <Button
            variant="outline"
            className="rounded-xl gap-2 border-primary/20 bg-background/80"
            onClick={() => setPhotoDialogOpen(true)}
            disabled={!activePlan}
          >
            <Sparkles className="h-4 w-4 text-primary" />
            Сделать фото генерацию
          </Button>
        )}

        <Button
          className="rounded-xl gap-2"
          onClick={handleSave}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {saveMutation.isPending ? "Saving..." : "Save"}
        </Button>
      </header>

      {/* ---- Content area ---- */}
      {!hasVariants && !isGenerating ? (
        /* === WIZARD MODE: Full-width centered wizard === */
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-3xl px-6 py-8 animate-fade-up">
            <PlannerWizard onComplete={handleGenerate} />
          </div>
        </div>
      ) : (
        /* === PLANNER MODE: 3-column layout === */
        <div className="flex flex-1 overflow-hidden">
          {/* Left sidebar — variants */}
          <aside className="w-72 shrink-0 overflow-y-auto border-r bg-background p-4 animate-fade-up lg:w-80">
            <div className="space-y-4">
              <VariantPanel onRegenerate={handleGenerate} />
              <GoldenTablePanel />
            </div>
          </aside>

          {/* Center — 3D viewer */}
          <main className="flex-1 overflow-hidden p-2 animate-fade-up" style={{ animationDelay: "80ms" }}>
            {isGenerating ? (
              <div className="flex h-full items-center justify-center gap-3 rounded-2xl border border-dashed border-border/60 bg-muted/20">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Generating kitchen plans...
                </span>
              </div>
            ) : (
              <div className="h-full rounded-2xl border border-border/60 overflow-hidden bg-background shadow-sm">
                <KitchenViewer
                  ref={viewerRef}
                  plan={activePlan}
                  roomConfig={roomConfig}
                  wallAnchors={wallAnchors}
                  selectedModuleId={selectedModuleId}
                  fridgeSide={fridgeSide}
                  onSelectModule={handleSelectModule}
                  onSelectCountertop={handleSelectCountertop}
                  countertopColor={countertopColor}
                  countertopTextureUrl={countertopTextureUrl}
                  facadeColor={facadeColor}
                  facadeTextureUrl={facadeTextureUrl}
                />
              </div>
            )}
          </main>

          {/* Right sidebar — module inspector */}
          <aside
            className="w-72 shrink-0 overflow-y-auto border-l bg-background p-4 animate-fade-up lg:w-80"
            style={{ animationDelay: "160ms" }}
          >
            <ModulePanel onColorChange={() => {}} />
            <CountertopPanel highlighted={countertopSelected} />
            <FacadePanel />
          </aside>
        </div>
      )}

      <PhotoGenerationDialog
        open={photoDialogOpen}
        onOpenChange={setPhotoDialogOpen}
        prompt={photoPrompt}
        statusMessage={photoStatusMessage}
        isGenerating={isPhotoGenerating}
        referenceImageUrl={referencePreviewUrl}
        generatedImageUrl={generatedPhotoUrl}
        onPromptChange={setPhotoPrompt}
        onGenerate={handleGeneratePhoto}
        onCancel={handleCancelPhoto}
      />
    </div>
  );
}
