import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { cabinetsApi } from "@/api/cabinets";
import { CabinetKind, CabinetType } from "@/types/enums";
import type { CabinetRead } from "@/types/entities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/shared/page-header";
import { ModelPreviewDialog } from "@/components/shared/model-preview-dialog";
import { ArrowLeft, X, Package, Eye } from "lucide-react";
import { capitalize } from "@/lib/utils";

export default function CabinetsPage() {
  const { id } = useParams<{ id: string }>();
  const categoryId = Number(id);

  const [previewItem, setPreviewItem] = useState<CabinetRead | null>(null);
  const [kind, setKind] = useState<string>("");
  const [type, setType] = useState<string>("");
  const [inbuilt, setInbuilt] = useState<boolean | undefined>(undefined);

  const { data: cabinets, isLoading } = useQuery({
    queryKey: ["cabinets", { categoryId, kind, type, inbuilt }],
    queryFn: () =>
      cabinetsApi.list({
        category_id: categoryId,
        kind: kind || undefined,
        type: type || undefined,
        inbuilt,
        limit: 100,
      }),
  });

  const hasFilters = kind || type || inbuilt !== undefined;

  const clearFilters = () => {
    setKind("");
    setType("");
    setInbuilt(undefined);
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4 animate-fade-up">
        <Button variant="ghost" size="icon" className="rounded-xl hover:bg-primary/8" onClick={() => window.history.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader title="Cabinets" description="Browse cabinets in this category" />
      </div>

      {/* Filters */}
      <div className="animate-fade-up flex flex-wrap items-end gap-4 rounded-xl border border-border/60 bg-card p-5" style={{ animationDelay: "100ms" }}>
        <div className="space-y-2">
          <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/70">Kind</Label>
          <Select value={kind} onValueChange={setKind}>
            <SelectTrigger className="w-40 rounded-lg">
              <SelectValue placeholder="All kinds" />
            </SelectTrigger>
            <SelectContent>
              {Object.values(CabinetKind).map((k) => (
                <SelectItem key={k} value={k}>
                  {capitalize(k)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/70">Type</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-40 rounded-lg">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              {Object.values(CabinetType).map((t) => (
                <SelectItem key={t} value={t}>
                  {capitalize(t)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2 pb-0.5">
          <Switch
            checked={inbuilt ?? false}
            onCheckedChange={(checked) => setInbuilt(checked ? true : undefined)}
          />
          <Label className="text-sm">Inbuilt only</Label>
        </div>

        {hasFilters && (
          <Button variant="ghost" size="sm" className="rounded-lg" onClick={clearFilters}>
            <X className="mr-1 h-4 w-4" />
            Clear
          </Button>
        )}
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-52 rounded-xl" />
          ))}
        </div>
      ) : cabinets?.length === 0 ? (
        <div className="flex h-52 items-center justify-center rounded-xl border border-dashed border-border/60">
          <div className="text-center">
            <Package className="mx-auto h-10 w-10 text-muted-foreground/25" />
            <p className="mt-3 text-muted-foreground">No cabinets found</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {cabinets?.map((cabinet, i) => (
            <Card key={cabinet.id} className="group animate-fade-up border-border/60 transition-all duration-300 hover:border-primary/30 hover:shadow-md cursor-pointer" style={{ animationDelay: `${(i + 1) * 60}ms` }} onClick={() => setPreviewItem(cabinet)}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{cabinet.article}</CardTitle>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-semibold text-primary">
                      ${cabinet.price}
                    </span>
                    <Eye className="h-4 w-4 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="rounded-md">{cabinet.kind}</Badge>
                  <Badge variant="outline" className="rounded-md">{cabinet.type}</Badge>
                  {cabinet.inbuilt && <Badge className="rounded-md">Inbuilt</Badge>}
                </div>
                {cabinet.description && (
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground line-clamp-2">
                    {cabinet.description}
                  </p>
                )}
                <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground/50">
                  <span>{cabinet.width} x {cabinet.height} x {cabinet.depth} mm</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <ModelPreviewDialog cabinet={previewItem} onOpenChange={() => setPreviewItem(null)} />
    </div>
  );
}
