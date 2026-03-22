import { useState, useMemo } from "react";
import { usePlannerStore } from "@/stores/planner-store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Wand2, Check } from "lucide-react";
import { RoomStep } from "./room-step";
import { WallsStep } from "./walls-step";
import { CatalogStep } from "./catalog-step";

interface PlannerWizardProps {
  onComplete: () => void;
}

const steps = [
  { id: 1, label: "Room Setup" },
  { id: 2, label: "Walls & Anchors" },
  { id: 3, label: "Select Catalog" },
];

export function PlannerWizard({ onComplete }: PlannerWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const { roomWidth, roomDepth, walls, selectedCatalogId } = usePlannerStore();

  const validation = useMemo(() => {
    const stepErrors: Record<number, string | null> = {
      1:
        roomWidth > 0 && roomDepth > 0
          ? null
          : "Room dimensions must be greater than 0",
      2:
        walls.length > 0
          ? (() => {
              for (const wall of walls) {
                for (let i = 0; i < wall.anchors.length; i++) {
                  const a = wall.anchors[i];
                  if (a.position < 0 || a.position + a.width > wall.length) {
                    return "Some anchors extend beyond wall bounds";
                  }
                  for (let j = i + 1; j < wall.anchors.length; j++) {
                    const b = wall.anchors[j];
                    if (
                      a.position < b.position + b.width &&
                      a.position + a.width > b.position
                    ) {
                      return "Some anchors overlap each other";
                    }
                  }
                }
              }
              return null;
            })()
          : "At least one wall is required",
      3:
        selectedCatalogId !== null
          ? null
          : "Please select a catalog",
    };
    return stepErrors;
  }, [roomWidth, roomDepth, walls, selectedCatalogId]);

  const canAdvance = validation[currentStep] === null;
  const isLastStep = currentStep === steps.length;

  const handleNext = () => {
    if (!canAdvance) return;
    if (isLastStep) {
      onComplete();
    } else {
      setCurrentStep((s) => s + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((s) => s - 1);
    }
  };

  return (
    <div className="space-y-6">
      {/* Step indicator — horizontal pills */}
      <nav>
        <ol className="flex items-center gap-3">
          {steps.map((step, i) => {
            const isActive = step.id === currentStep;
            const isCompleted = step.id < currentStep;
            const isValid = validation[step.id] === null;

            return (
              <li key={step.id} className="flex items-center gap-3">
                {i > 0 && (
                  <div
                    className={cn(
                      "h-px w-6",
                      isCompleted ? "bg-primary" : "bg-border",
                    )}
                  />
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (step.id <= currentStep) setCurrentStep(step.id);
                  }}
                  className={cn(
                    "flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium transition-all",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : isCompleted
                        ? "bg-primary/10 text-primary hover:bg-primary/20"
                        : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-5 w-5 items-center justify-center rounded-full text-[11px]",
                      isActive
                        ? "bg-primary-foreground/20"
                        : isCompleted && isValid
                          ? "bg-primary/20"
                          : "bg-muted",
                    )}
                  >
                    {isCompleted && isValid ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      step.id
                    )}
                  </span>
                  {step.label}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Step content */}
      <div className="rounded-2xl border border-border/60 bg-background p-6 shadow-sm">
        {currentStep === 1 && <RoomStep />}
        {currentStep === 2 && <WallsStep />}
        {currentStep === 3 && <CatalogStep />}
      </div>

      {/* Validation message */}
      {validation[currentStep] && (
        <p className="text-center text-sm text-destructive">
          {validation[currentStep]}
        </p>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={handleBack}
          disabled={currentStep === 1}
          className="gap-2 rounded-xl"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </Button>

        <Button
          type="button"
          onClick={handleNext}
          disabled={!canAdvance}
          className="gap-2 rounded-xl"
        >
          {isLastStep ? (
            <>
              <Wand2 className="h-4 w-4" />
              Generate Plan
            </>
          ) : (
            <>
              Next
              <ChevronRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
