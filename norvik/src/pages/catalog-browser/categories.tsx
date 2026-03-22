import { useState, useEffect, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { type ColumnDef } from "@tanstack/react-table";
import { categoriesApi } from "@/api/categories";
import { catalogsApi } from "@/api/catalogs";
import { cabinetsApi } from "@/api/cabinets";
import { CabinetKind, CabinetType } from "@/types/enums";
import type { CabinetRead } from "@/types/entities";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { ModelPreviewDialog } from "@/components/shared/model-preview-dialog";
import { createActionsColumn } from "@/components/shared/actions-column";
import { ArrowLeft, FolderOpen, X, Eye } from "lucide-react";
import { capitalize } from "@/lib/utils";
import { ROUTES } from "@/lib/constants";

function getCabinetBrowserColumns(
  onPreview: (item: CabinetRead) => void,
): ColumnDef<CabinetRead>[] {
  return [
    {
      accessorKey: "article",
      header: "Article",
      cell: ({ row }) => (
        <span className="font-medium">{row.original.article}</span>
      ),
    },
    {
      accessorKey: "kind",
      header: "Kind",
      cell: ({ row }) => (
        <Badge variant="secondary" className="rounded-md">
          {capitalize(row.original.kind)}
        </Badge>
      ),
    },
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ row }) => (
        <Badge variant="outline" className="rounded-md">
          {capitalize(row.original.type)}
        </Badge>
      ),
    },
    {
      accessorKey: "subtype",
      header: "Subtype",
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {capitalize(row.original.subtype)}
        </span>
      ),
    },
    {
      id: "dimensions",
      header: "Dimensions",
      cell: ({ row }) => (
        <span className="text-sm">
          {row.original.width} x {row.original.height} x {row.original.depth} mm
        </span>
      ),
    },
    {
      accessorKey: "price",
      header: "Price",
      cell: ({ row }) => (
        <span className="font-medium">${row.original.price}</span>
      ),
    },
    {
      accessorKey: "inbuilt",
      header: "Inbuilt",
      cell: ({ row }) =>
        row.original.inbuilt ? (
          <Badge className="rounded-md">Yes</Badge>
        ) : (
          <span className="text-muted-foreground">No</span>
        ),
    },
    createActionsColumn<CabinetRead>({
      extraActions: [
        {
          label: "Preview",
          icon: <Eye className="mr-2 h-4 w-4" />,
          onClick: onPreview,
        },
      ],
    }),
  ];
}

export default function CategoriesPage() {
  const { id } = useParams<{ id: string }>();
  const catalogId = Number(id);

  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(
    null,
  );
  const [previewItem, setPreviewItem] = useState<CabinetRead | null>(null);
  const [kind, setKind] = useState<string>("");
  const [type, setType] = useState<string>("");
  const [inbuilt, setInbuilt] = useState<boolean | undefined>(undefined);

  // Reset selection and filters when navigating to a different catalog
  useEffect(() => {
    setSelectedCategoryId(null);
    setKind("");
    setType("");
    setInbuilt(undefined);
  }, [catalogId]);

  const { data: catalog } = useQuery({
    queryKey: ["catalogs", catalogId],
    queryFn: () => catalogsApi.getById(catalogId),
  });

  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ["categories", "byCatalog", catalogId],
    queryFn: () => categoriesApi.listByCatalog(catalogId),
  });

  // Auto-select first category when loaded
  const activeCategoryId =
    selectedCategoryId ?? (categories.length > 0 ? categories[0].id : null);

  const { data: cabinets = [], isLoading: cabinetsLoading } = useQuery({
    queryKey: [
      "cabinets",
      { categoryId: activeCategoryId, kind, type, inbuilt },
    ],
    queryFn: () =>
      cabinetsApi.list({
        category_id: activeCategoryId!,
        kind: kind || undefined,
        type: type || undefined,
        inbuilt,
        limit: 200,
      }),
    enabled: activeCategoryId !== null,
  });

  const hasFilters = kind || type || inbuilt !== undefined;
  const clearFilters = () => {
    setKind("");
    setType("");
    setInbuilt(undefined);
  };

  const columns = useMemo(() => getCabinetBrowserColumns(setPreviewItem), []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 animate-fade-up">
        <Link to={ROUTES.CATALOGS}>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-xl hover:bg-primary/8"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <PageHeader
          title={catalog?.name ?? "Catalog"}
          description="Browse categories and cabinets"
        />
      </div>

      {/* Main content */}
      {categoriesLoading ? (
        <div className="flex gap-6 animate-fade-up" style={{ animationDelay: "80ms" }}>
          <div className="w-56 shrink-0 space-y-2">
            <Skeleton className="h-4 w-20 mb-3" />
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 rounded-lg" />
            ))}
          </div>
          <div className="flex-1">
            <Skeleton className="h-64 rounded-xl" />
          </div>
        </div>
      ) : categories.length === 0 ? (
        <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-border/60 animate-fade-up" style={{ animationDelay: "80ms" }}>
          <div className="text-center">
            <FolderOpen className="mx-auto h-10 w-10 text-muted-foreground/25" />
            <p className="mt-3 text-muted-foreground">No categories in this catalog</p>
            <p className="mt-1 text-sm text-muted-foreground/60">
              Categories and cabinets will appear here once added by an administrator
            </p>
          </div>
        </div>
      ) : (
        <div className="flex gap-6 animate-fade-up" style={{ animationDelay: "80ms" }}>
          {/* Categories sidebar */}
          <div className="w-56 shrink-0">
            <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground/70">
              Categories
            </p>
            <nav className="space-y-1">
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => { setSelectedCategoryId(category.id); clearFilters(); }}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-all text-left ${
                    activeCategoryId === category.id
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <FolderOpen className="h-4 w-4 shrink-0" />
                  <span className="truncate">{category.name}</span>
                </button>
              ))}
            </nav>
          </div>

          {/* Cabinets content */}
          <div className="flex-1 min-w-0 space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap items-end gap-4 rounded-xl border border-border/60 bg-card p-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/70">
                  Kind
                </Label>
                <Select value={kind} onValueChange={setKind}>
                  <SelectTrigger className="w-36 rounded-lg">
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

              <div className="space-y-1.5">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/70">
                  Type
                </Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger className="w-36 rounded-lg">
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
                  onCheckedChange={(checked) =>
                    setInbuilt(checked ? true : undefined)
                  }
                />
                <Label className="text-sm">Inbuilt only</Label>
              </div>

              {hasFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-lg"
                  onClick={clearFilters}
                >
                  <X className="mr-1 h-4 w-4" />
                  Clear
                </Button>
              )}
            </div>

            {/* Table */}
            <DataTable
              columns={columns}
              data={cabinets}
              isLoading={cabinetsLoading}
            />
          </div>
        </div>
      )}

      <ModelPreviewDialog
        cabinet={previewItem}
        onOpenChange={() => setPreviewItem(null)}
      />
    </div>
  );
}
