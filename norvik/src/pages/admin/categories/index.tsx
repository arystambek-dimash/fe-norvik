import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { categoriesApi } from "@/api/categories";
import { catalogsApi } from "@/api/catalogs";
import type { CategoryRead } from "@/types/entities";
import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { CrudDialog } from "@/components/shared/crud-dialog";
import { DeleteDialog } from "@/components/shared/delete-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePagination } from "@/hooks/use-pagination";
import { getCategoryColumns } from "./columns";
import { Plus } from "lucide-react";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  catalog_id: z.number().min(1, "Select a catalog"),
});

export default function AdminCategoriesPage() {
  const queryClient = useQueryClient();
  const pagination = usePagination();
  const [createOpen, setCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<CategoryRead | null>(null);
  const [deleteItem, setDeleteItem] = useState<CategoryRead | null>(null);

  const { data = [], isLoading } = useQuery({
    queryKey: ["categories", pagination.offset, pagination.limit],
    queryFn: () => categoriesApi.list({ offset: pagination.offset, limit: pagination.limit }),
  });

  const { data: catalogs = [] } = useQuery({
    queryKey: ["catalogs"],
    queryFn: () => catalogsApi.list({ limit: 1000 }),
  });

  const catalogMap = new Map(catalogs.map((c) => [c.id, c.name]));

  const createForm = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { catalog_id: 0 } });
  const editForm = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });

  const createMutation = useMutation({
    mutationFn: categoriesApi.create,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["categories"] }); toast.success("Category created"); setCreateOpen(false); createForm.reset(); },
    onError: () => toast.error("Failed to create category"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: z.infer<typeof schema> }) => categoriesApi.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["categories"] }); toast.success("Category updated"); setEditItem(null); },
    onError: () => toast.error("Failed to update category"),
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id, hard }: { id: number; hard: boolean }) => categoriesApi.delete(id, hard),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["categories"] }); toast.success("Category deleted"); setDeleteItem(null); },
    onError: () => toast.error("Failed to delete category"),
  });

  const columns = getCategoryColumns({
    onEdit: (item) => { editForm.reset({ name: item.name, catalog_id: item.catalog_id }); setEditItem(item); },
    onDelete: setDeleteItem,
    catalogName: (id) => catalogMap.get(id) ?? `#${id}`,
  });

  const catalogSelector = (form: ReturnType<typeof useForm<z.infer<typeof schema>>>, fieldName: "catalog_id") => (
    <div className="space-y-2">
      <Label>Catalog</Label>
      <Select value={String(form.watch(fieldName) || "")} onValueChange={(v) => form.setValue(fieldName, Number(v))}>
        <SelectTrigger><SelectValue placeholder="Select catalog" /></SelectTrigger>
        <SelectContent>
          {catalogs.map((c) => (
            <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <div className="space-y-8">
      <div className="animate-fade-up">
        <PageHeader title="Categories" description="Manage product categories" action={<Button className="rounded-lg" onClick={() => setCreateOpen(true)}><Plus className="mr-2 h-4 w-4" />Add Category</Button>} />
      </div>
      <DataTable columns={columns} data={data} isLoading={isLoading} pagination={{ offset: pagination.offset, limit: pagination.limit, onNext: pagination.nextPage, onPrev: pagination.prevPage }} />

      <CrudDialog open={createOpen} onOpenChange={setCreateOpen} title="Add Category" onSubmit={createForm.handleSubmit((d) => createMutation.mutate(d))} isLoading={createMutation.isPending} submitLabel="Create">
        <div className="space-y-4">
          <div className="space-y-2"><Label>Name</Label><Input {...createForm.register("name")} /></div>
          {catalogSelector(createForm, "catalog_id")}
        </div>
      </CrudDialog>

      <CrudDialog open={editItem !== null} onOpenChange={() => setEditItem(null)} title="Edit Category" onSubmit={editForm.handleSubmit((d) => editItem && updateMutation.mutate({ id: editItem.id, data: d }))} isLoading={updateMutation.isPending}>
        <div className="space-y-4">
          <div className="space-y-2"><Label>Name</Label><Input {...editForm.register("name")} /></div>
          {catalogSelector(editForm, "catalog_id")}
        </div>
      </CrudDialog>

      <DeleteDialog open={deleteItem !== null} onOpenChange={() => setDeleteItem(null)} onConfirm={(hard) => deleteItem && deleteMutation.mutate({ id: deleteItem.id, hard })} title={`Delete ${deleteItem?.name}?`} isLoading={deleteMutation.isPending} showHardDelete />
    </div>
  );
}