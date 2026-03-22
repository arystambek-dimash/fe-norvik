import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { catalogsApi } from "@/api/catalogs";
import { cabinetsApi } from "@/api/cabinets";
import { usePlannerStore } from "@/stores/planner-store";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { BookOpen, Check } from "lucide-react";

export function CatalogStep() {
  const { selectedCatalogId, setSelectedCatalogId, setModules } =
    usePlannerStore();

  const { data: catalogs, isLoading } = useQuery({
    queryKey: ["catalogs"],
    queryFn: () => catalogsApi.list(),
  });

  // Fetch modules when a catalog is selected
  const { data: modules, isFetching: isLoadingModules } = useQuery({
    queryKey: ["cabinets", { catalog_id: selectedCatalogId }],
    queryFn: () => cabinetsApi.list({ catalog_id: selectedCatalogId! }),
    enabled: selectedCatalogId !== null,
  });

  // Sync modules to store when they arrive
  useEffect(() => {
    if (modules) {
      setModules(modules);
    }
  }, [modules, setModules]);

  const handleSelect = (catalogId: number) => {
    if (catalogId === selectedCatalogId) return;
    setSelectedCatalogId(catalogId);
    setModules([]); // Clear until new modules load
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-lg font-semibold">Select Catalog</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Choose a cabinet catalog for your kitchen plan
        </p>
      </div>

      {isLoading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-52 rounded-xl" />
          ))}
        </div>
      ) : catalogs?.length === 0 ? (
        <div className="flex h-52 items-center justify-center rounded-xl border border-dashed border-border/60">
          <p className="text-muted-foreground">No catalogs available</p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {catalogs?.map((catalog, i) => {
            const selected = catalog.id === selectedCatalogId;
            return (
              <button
                key={catalog.id}
                type="button"
                onClick={() => handleSelect(catalog.id)}
                className="text-left"
              >
                <Card
                  className={cn(
                    "group animate-fade-up overflow-hidden transition-all duration-300",
                    selected
                      ? "border-primary ring-2 ring-primary/20 shadow-md"
                      : "border-border/60 hover:border-primary/30 hover:shadow-md"
                  )}
                  style={{ animationDelay: `${(i + 1) * 80}ms` }}
                >
                  {catalog.preview_img ? (
                    <div className="relative h-36 overflow-hidden bg-muted">
                      <img
                        src={catalog.preview_img}
                        alt={catalog.name}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      {selected && (
                        <div className="absolute inset-0 flex items-center justify-center bg-primary/20">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
                            <Check className="h-5 w-5" />
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="relative flex h-36 items-center justify-center bg-muted/50">
                      {selected ? (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Check className="h-5 w-5" />
                        </div>
                      ) : (
                        <BookOpen className="h-10 w-10 text-muted-foreground/25" />
                      )}
                    </div>
                  )}
                  <CardHeader>
                    <CardTitle className="text-lg">{catalog.name}</CardTitle>
                  </CardHeader>
                </Card>
              </button>
            );
          })}
        </div>
      )}

      {selectedCatalogId !== null && isLoadingModules && (
        <p className="text-center text-sm text-muted-foreground animate-pulse">
          Loading cabinet modules...
        </p>
      )}

      {selectedCatalogId !== null && modules && modules.length > 0 && (
        <p className="text-center text-sm text-muted-foreground">
          {modules.length} cabinet modules available
        </p>
      )}
    </div>
  );
}
