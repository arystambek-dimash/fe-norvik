import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { catalogsApi } from "@/api/catalogs";
import type { CatalogRead } from "@/types/entities";
import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { CrudDialog } from "@/components/shared/crud-dialog";
import { DeleteDialog } from "@/components/shared/delete-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePagination } from "@/hooks/use-pagination";
import { getCatalogColumns } from "./columns";
import { Plus } from "lucide-react";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  preview_img: z.string().nullable().optional(),
});

export default function AdminCatalogsPage() {
  const queryClient = useQueryClient();
  const pagination = usePagination();
  const [createOpen, setCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<CatalogRead | null>(null);
  const [deleteItem, setDeleteItem] = useState<CatalogRead | null>(null);

  const { data = [], isLoading } = useQuery({
    queryKey: ["catalogs", pagination.offset, pagination.limit],
    queryFn: () => catalogsApi.list({ offset: pagination.offset, limit: pagination.limit }),
  });

  const createForm = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  const editForm = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });

  const createMutation = useMutation({
    mutationFn: catalogsApi.create,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["catalogs"] }); toast.success("Catalog created"); setCreateOpen(false); createForm.reset(); },
    onError: () => toast.error("Failed to create catalog"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: z.infer<typeof schema> }) => catalogsApi.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["catalogs"] }); toast.success("Catalog updated"); setEditItem(null); },
    onError: () => toast.error("Failed to update catalog"),
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id, hard }: { id: number; hard: boolean }) => catalogsApi.delete(id, hard),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["catalogs"] }); toast.success("Catalog deleted"); setDeleteItem(null); },
    onError: () => toast.error("Failed to delete catalog"),
  });

  const columns = getCatalogColumns({
    onEdit: (item) => { editForm.reset({ name: item.name, preview_img: item.preview_img }); setEditItem(item); },
    onDelete: setDeleteItem,
  });

  return (
    <div className="space-y-8">
      <div className="animate-fade-up">
        <PageHeader title="Catalogs" description="Manage product catalogs" action={<Button className="rounded-lg" onClick={() => setCreateOpen(true)}><Plus className="mr-2 h-4 w-4" />Add Catalog</Button>} />
      </div>
      <DataTable columns={columns} data={data} isLoading={isLoading} pagination={{ offset: pagination.offset, limit: pagination.limit, onNext: pagination.nextPage, onPrev: pagination.prevPage }} />

      <CrudDialog open={createOpen} onOpenChange={setCreateOpen} title="Add Catalog" onSubmit={createForm.handleSubmit((d) => createMutation.mutate(d))} isLoading={createMutation.isPending} submitLabel="Create">
        <div className="space-y-4">
          <div className="space-y-2"><Label>Name</Label><Input {...createForm.register("name")} /></div>
          <div className="space-y-2"><Label>Preview Image URL</Label><Input {...createForm.register("preview_img")} placeholder="https://..." /></div>
        </div>
      </CrudDialog>

      <CrudDialog open={editItem !== null} onOpenChange={() => setEditItem(null)} title="Edit Catalog" onSubmit={editForm.handleSubmit((d) => editItem && updateMutation.mutate({ id: editItem.id, data: d }))} isLoading={updateMutation.isPending}>
        <div className="space-y-4">
          <div className="space-y-2"><Label>Name</Label><Input {...editForm.register("name")} /></div>
          <div className="space-y-2"><Label>Preview Image URL</Label><Input {...editForm.register("preview_img")} placeholder="https://..." /></div>
        </div>
      </CrudDialog>

      <DeleteDialog open={deleteItem !== null} onOpenChange={() => setDeleteItem(null)} onConfirm={(hard) => deleteItem && deleteMutation.mutate({ id: deleteItem.id, hard })} title={`Delete ${deleteItem?.name}?`} isLoading={deleteMutation.isPending} showHardDelete />
    </div>
  );
}