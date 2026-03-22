import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { companiesApi } from "@/api/companies";
import type { CompanyRead } from "@/types/entities";
import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { CrudDialog } from "@/components/shared/crud-dialog";
import { DeleteDialog } from "@/components/shared/delete-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePagination } from "@/hooks/use-pagination";
import { getCompanyColumns } from "./columns";
import { Plus } from "lucide-react";

const schema = z.object({ name: z.string().min(1, "Name is required") });

export default function AdminCompaniesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pagination = usePagination();
  const [createOpen, setCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<CompanyRead | null>(null);
  const [deleteItem, setDeleteItem] = useState<CompanyRead | null>(null);

  const { data = [], isLoading } = useQuery({
    queryKey: ["companies", pagination.offset, pagination.limit],
    queryFn: () => companiesApi.list({ offset: pagination.offset, limit: pagination.limit }),
  });

  const createForm = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  const editForm = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });

  const createMutation = useMutation({
    mutationFn: companiesApi.create,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["companies"] }); toast.success("Company created"); setCreateOpen(false); createForm.reset(); },
    onError: () => toast.error("Failed to create company"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: z.infer<typeof schema> }) => companiesApi.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["companies"] }); toast.success("Company updated"); setEditItem(null); },
    onError: () => toast.error("Failed to update company"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => companiesApi.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["companies"] }); toast.success("Company deleted"); setDeleteItem(null); },
    onError: () => toast.error("Failed to delete company"),
  });

  const columns = getCompanyColumns({
    onEdit: (item) => { editForm.reset({ name: item.name }); setEditItem(item); },
    onDelete: setDeleteItem,
    onViewUsers: (item) => navigate(`/admin/companies/${item.id}/users`),
  });

  return (
    <div className="space-y-8">
      <div className="animate-fade-up">
        <PageHeader title="Companies" description="Manage company accounts" action={<Button className="rounded-lg" onClick={() => setCreateOpen(true)}><Plus className="mr-2 h-4 w-4" />Add Company</Button>} />
      </div>
      <DataTable columns={columns} data={data} isLoading={isLoading} pagination={{ offset: pagination.offset, limit: pagination.limit, onNext: pagination.nextPage, onPrev: pagination.prevPage }} />

      <CrudDialog open={createOpen} onOpenChange={setCreateOpen} title="Add Company" onSubmit={createForm.handleSubmit((d) => createMutation.mutate(d))} isLoading={createMutation.isPending} submitLabel="Create">
        <div className="space-y-2"><Label>Name</Label><Input {...createForm.register("name")} /></div>
      </CrudDialog>

      <CrudDialog open={editItem !== null} onOpenChange={() => setEditItem(null)} title="Edit Company" onSubmit={editForm.handleSubmit((d) => editItem && updateMutation.mutate({ id: editItem.id, data: d }))} isLoading={updateMutation.isPending}>
        <div className="space-y-2"><Label>Name</Label><Input {...editForm.register("name")} /></div>
      </CrudDialog>

      <DeleteDialog open={deleteItem !== null} onOpenChange={() => setDeleteItem(null)} onConfirm={() => deleteItem && deleteMutation.mutate(deleteItem.id)} title={`Delete ${deleteItem?.name}?`} isLoading={deleteMutation.isPending} />
    </div>
  );
}