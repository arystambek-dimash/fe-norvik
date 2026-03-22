import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { cabinetsApi } from "@/api/cabinets";
import { catalogsApi } from "@/api/catalogs";
import { categoriesApi } from "@/api/categories";
import { CabinetKind, CabinetSubtype, CabinetType } from "@/types/enums";
import type { CabinetRead } from "@/types/entities";
import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { CrudDialog } from "@/components/shared/crud-dialog";
import { DeleteDialog } from "@/components/shared/delete-dialog";
import { ModelPreviewDialog } from "@/components/shared/model-preview-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getCabinetColumns } from "./columns";
import { Plus, X, FolderOpen, Package } from "lucide-react";
import { capitalize } from "@/lib/utils";

const createSchema = z.object({
  article: z.string().min(1, "Article is required"),
  kind: z.string().min(1, "Kind is required"),
  type: z.string().min(1, "Type is required"),
  subtype: z.string().min(1, "Subtype is required"),
  category_id: z.number().min(1, "Select a category"),
  price: z.string().optional(),
  width: z.coerce.number().min(1, "Width is required"),
  height: z.coerce.number().min(1, "Height is required"),
  depth: z.coerce.number().min(1, "Depth is required"),
  inbuilt: z.boolean(),
  is_corner: z.boolean(),
  drawer_count: z.coerce.number().nullable().optional(),
  description: z.string().nullable().optional(),
});

type FormValues = z.infer<typeof createSchema>;

export default function AdminCabinetsPage() {
  const queryClient = useQueryClient();
  const [selectedCatalogId, setSelectedCatalogId] = useState<number | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<CabinetRead | null>(null);
  const [deleteItem, setDeleteItem] = useState<CabinetRead | null>(null);
  const [previewItem, setPreviewItem] = useState<CabinetRead | null>(null);
  const [glbFile, setGlbFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Catalogs list
  const { data: catalogs = [] } = useQuery({
    queryKey: ["catalogs"],
    queryFn: () => catalogsApi.list(),
  });

  // Auto-select first catalog
  useEffect(() => {
    if (catalogs.length > 0 && selectedCatalogId === null) {
      setSelectedCatalogId(catalogs[0].id);
    }
  }, [catalogs, selectedCatalogId]);

  // Categories for selected catalog
  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ["categories", "byCatalog", selectedCatalogId],
    queryFn: () => categoriesApi.listByCatalog(selectedCatalogId!),
    enabled: selectedCatalogId !== null,
  });

  // Auto-select first category
  const activeCategoryId =
    selectedCategoryId ?? (categories.length > 0 ? categories[0].id : null);

  // Reset category when catalog changes
  useEffect(() => {
    setSelectedCategoryId(null);
  }, [selectedCatalogId]);

  // Cabinets for selected category
  const { data: cabinets = [], isLoading: cabinetsLoading } = useQuery({
    queryKey: ["cabinets", { categoryId: activeCategoryId }],
    queryFn: () =>
      cabinetsApi.list({
        category_id: activeCategoryId!,
        limit: 200,
      }),
    enabled: activeCategoryId !== null,
  });

  // Use catalog-filtered categories for the form dropdown too
  const allCategories = categories;

  const defaultFormValues: FormValues = {
    article: "", kind: "", type: "", subtype: "",
    inbuilt: false, is_corner: false, drawer_count: null, category_id: activeCategoryId ?? 0, price: "0", width: 0, height: 0, depth: 0,
  };

  const createForm = useForm<FormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: defaultFormValues,
  });

  const editForm = useForm<FormValues>({
    resolver: zodResolver(createSchema),
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const cabinet = await cabinetsApi.create(data);
      if (glbFile) {
        await cabinetsApi.uploadGlb(cabinet.id, glbFile);
      }
      return cabinet;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["cabinets"] }); toast.success("Cabinet created"); setCreateOpen(false); createForm.reset(); setGlbFile(null); },
    onError: () => toast.error("Failed to create cabinet"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: FormValues }) => {
      const cabinet = await cabinetsApi.update(id, data);
      if (glbFile) {
        await cabinetsApi.uploadGlb(id, glbFile);
      }
      return cabinet;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["cabinets"] }); toast.success("Cabinet updated"); setEditItem(null); setGlbFile(null); },
    onError: () => toast.error("Failed to update cabinet"),
  });

  const deleteGlbMutation = useMutation({
    mutationFn: (cabinetId: number) => cabinetsApi.deleteGlb(cabinetId),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["cabinets"] }); toast.success("GLB file removed"); },
    onError: () => toast.error("Failed to remove GLB file"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => cabinetsApi.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["cabinets"] }); toast.success("Cabinet deleted"); setDeleteItem(null); },
    onError: () => toast.error("Failed to delete cabinet"),
  });

  const columns = useMemo(() => getCabinetColumns({
    onEdit: (item) => {
      editForm.reset({
        article: item.article,
        kind: item.kind,
        type: item.type,
        subtype: item.subtype,
        category_id: item.category_id,
        price: item.price,
        width: item.width,
        height: item.height,
        depth: item.depth,
        inbuilt: item.inbuilt,
        is_corner: item.is_corner,
        drawer_count: item.drawer_count,
        description: item.description,
      });
      setGlbFile(null);
      setEditItem(item);
    },
    onDelete: setDeleteItem,
    onPreview: setPreviewItem,
  }), [editForm]);

  const handleCreate = () => {
    createForm.reset({ ...defaultFormValues, category_id: activeCategoryId ?? 0 });
    setCreateOpen(true);
  };

  const formFields = (form: ReturnType<typeof useForm<FormValues>>, currentItem: CabinetRead | null = null) => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Article</Label>
        <Input {...form.register("article")} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Kind</Label>
          <Select value={form.watch("kind")} onValueChange={(v) => { form.setValue("kind", v); if (v !== CabinetKind.DRAWER_UNIT) form.setValue("drawer_count", null); }}>
            <SelectTrigger><SelectValue placeholder="Select kind" /></SelectTrigger>
            <SelectContent>
              {Object.values(CabinetKind).map((k) => (
                <SelectItem key={k} value={k}>{capitalize(k)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Type</Label>
          <Select value={form.watch("type")} onValueChange={(v) => form.setValue("type", v)}>
            <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
            <SelectContent>
              {Object.values(CabinetType).map((t) => (
                <SelectItem key={t} value={t}>{capitalize(t)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Subtype</Label>
        <Select value={form.watch("subtype")} onValueChange={(v) => form.setValue("subtype", v)}>
          <SelectTrigger><SelectValue placeholder="Select subtype" /></SelectTrigger>
          <SelectContent>
            {Object.values(CabinetSubtype).map((s) => (
              <SelectItem key={s} value={s}>{capitalize(s)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Category</Label>
        <Select value={String(form.watch("category_id") || "")} onValueChange={(v) => form.setValue("category_id", Number(v))}>
          <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
          <SelectContent>
            {allCategories.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Width (mm)</Label>
          <Input type="number" {...form.register("width", { valueAsNumber: true })} placeholder="600" />
        </div>
        <div className="space-y-2">
          <Label>Height (mm)</Label>
          <Input type="number" {...form.register("height", { valueAsNumber: true })} placeholder="720" />
        </div>
        <div className="space-y-2">
          <Label>Depth (mm)</Label>
          <Input type="number" {...form.register("depth", { valueAsNumber: true })} placeholder="560" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Price</Label>
          <Input {...form.register("price")} placeholder="0.00" />
        </div>
        <div className="flex items-center gap-4 pt-7">
          <div className="flex items-center gap-2">
            <Switch checked={form.watch("inbuilt")} onCheckedChange={(v) => form.setValue("inbuilt", v)} />
            <Label>Inbuilt</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={form.watch("is_corner")} onCheckedChange={(v) => form.setValue("is_corner", v)} />
            <Label>Corner</Label>
          </div>
        </div>
      </div>
      {form.watch("kind") === CabinetKind.DRAWER_UNIT && (
        <div className="space-y-2">
          <Label>Drawer Count</Label>
          <Input type="number" {...form.register("drawer_count", { valueAsNumber: true })} placeholder="2" min={1} max={10} />
        </div>
      )}
      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea {...form.register("description")} placeholder="Optional description..." />
      </div>
      <div className="space-y-2">
        <Label>GLB File</Label>
        {currentItem?.glb_file && !glbFile && (
          <div className="flex items-center gap-2 text-sm">
            <a href={currentItem.glb_file} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline truncate max-w-[200px]">
              {currentItem.glb_file.split("/").pop()}
            </a>
            <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteGlbMutation.mutate(currentItem.id)}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}
        <Input
          ref={fileInputRef}
          type="file"
          accept=".glb"
          onChange={(e) => setGlbFile(e.target.files?.[0] ?? null)}
        />
        {glbFile && <p className="text-xs text-muted-foreground">{glbFile.name}</p>}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="animate-fade-up">
        <PageHeader
          title="Cabinets"
          description="Manage cabinet inventory"
          action={
            <Button className="rounded-lg" onClick={handleCreate} disabled={activeCategoryId === null}>
              <Plus className="mr-2 h-4 w-4" />Add Cabinet
            </Button>
          }
        />
      </div>

      {/* Catalog selector */}
      <div className="animate-fade-up" style={{ animationDelay: "60ms" }}>
        <div className="flex items-center gap-3">
          <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/70">Catalog</Label>
          <Select
            value={selectedCatalogId ? String(selectedCatalogId) : ""}
            onValueChange={(v) => setSelectedCatalogId(Number(v))}
          >
            <SelectTrigger className="w-60 rounded-lg">
              <SelectValue placeholder="Select catalog" />
            </SelectTrigger>
            <SelectContent>
              {catalogs.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Main content: categories sidebar + cabinets table */}
      {selectedCatalogId === null ? (
        <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-border/60 animate-fade-up">
          <div className="text-center">
            <Package className="mx-auto h-10 w-10 text-muted-foreground/25" />
            <p className="mt-3 text-muted-foreground">Select a catalog to manage cabinets</p>
          </div>
        </div>
      ) : categoriesLoading ? (
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
            <p className="mt-1 text-sm text-muted-foreground/60">Create categories first in the Categories admin page</p>
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
                  onClick={() => setSelectedCategoryId(category.id)}
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

          {/* Cabinets table */}
          <div className="flex-1 min-w-0">
            <DataTable columns={columns} data={cabinets} isLoading={cabinetsLoading} />
          </div>
        </div>
      )}

      {/* Dialogs */}
      <CrudDialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) setGlbFile(null); }} title="Add Cabinet" onSubmit={createForm.handleSubmit((d) => createMutation.mutate(d))} isLoading={createMutation.isPending} submitLabel="Create">
        {formFields(createForm)}
      </CrudDialog>

      <CrudDialog open={editItem !== null} onOpenChange={(open) => { if (!open) { setEditItem(null); setGlbFile(null); } }} title="Edit Cabinet" onSubmit={editForm.handleSubmit((d) => editItem && updateMutation.mutate({ id: editItem.id, data: d }))} isLoading={updateMutation.isPending}>
        {formFields(editForm, editItem)}
      </CrudDialog>

      <DeleteDialog open={deleteItem !== null} onOpenChange={() => setDeleteItem(null)} onConfirm={() => deleteItem && deleteMutation.mutate(deleteItem.id)} title={`Delete ${deleteItem?.article}?`} isLoading={deleteMutation.isPending} />

      <ModelPreviewDialog cabinet={previewItem} onOpenChange={() => setPreviewItem(null)} />
    </div>
  );
}
