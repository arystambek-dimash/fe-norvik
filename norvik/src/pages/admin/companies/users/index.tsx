import { useState, useMemo } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { companiesApi } from "@/api/companies";
import { usersApi } from "@/api/users";
import type { CompanyUserRead, UserRead } from "@/types/entities";
import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { CrudDialog } from "@/components/shared/crud-dialog";
import { DeleteDialog } from "@/components/shared/delete-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePagination } from "@/hooks/use-pagination";
import { getCompanyUserColumns } from "./columns";
import { ROUTES } from "@/lib/constants";
import { ArrowLeft, Plus } from "lucide-react";

export default function AdminCompanyUsersPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pagination = usePagination();
  const [addOpen, setAddOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [removeUser, setRemoveUser] = useState<CompanyUserRead | null>(null);

  if (!companyId || isNaN(Number(companyId))) {
    return <Navigate to={ROUTES.ADMIN_COMPANIES} replace />;
  }

  const numericCompanyId = Number(companyId);

  const { data: companyUsers = [], isLoading } = useQuery({
    queryKey: ["company-users", numericCompanyId, pagination.offset, pagination.limit],
    queryFn: () => companiesApi.listUsers(numericCompanyId, { offset: pagination.offset, limit: pagination.limit }),
    enabled: !!companyId,
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => usersApi.list({ limit: 1000 }),
    enabled: addOpen,
  });

  const availableUsers = useMemo(() => {
    const existingIds = new Set(companyUsers.map((cu) => cu.id));
    return allUsers.filter((user) => !existingIds.has(user.id));
  }, [allUsers, companyUsers]);

  const addMutation = useMutation({
    mutationFn: (userId: number) => companiesApi.addUser(numericCompanyId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-users", numericCompanyId] });
      toast.success("User added to company");
      setAddOpen(false);
      setSelectedUserId(null);
    },
    onError: () => toast.error("Failed to add user"),
  });

  const removeMutation = useMutation({
    mutationFn: (userId: number) => companiesApi.removeUser(numericCompanyId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-users", numericCompanyId] });
      toast.success("User removed from company");
      setRemoveUser(null);
    },
    onError: () => toast.error("Failed to remove user"),
  });

  const columns = getCompanyUserColumns({ onRemove: setRemoveUser });

  return (
    <div className="space-y-8">
      <div className="animate-fade-up">
        <PageHeader
          title="Company Users"
          description="Manage users in this company"
          action={
            <div className="flex gap-2">
              <Button variant="outline" className="rounded-lg" onClick={() => navigate(ROUTES.ADMIN_COMPANIES)}>
                <ArrowLeft className="mr-2 h-4 w-4" />Back
              </Button>
              <Button className="rounded-lg" onClick={() => setAddOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />Add User
              </Button>
            </div>
          }
        />
      </div>

      <DataTable
        columns={columns}
        data={companyUsers}
        isLoading={isLoading}
        pagination={{
          offset: pagination.offset,
          limit: pagination.limit,
          onNext: pagination.nextPage,
          onPrev: pagination.prevPage,
        }}
      />

      <CrudDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        title="Add User to Company"
        onSubmit={(e) => { e.preventDefault(); if (selectedUserId) addMutation.mutate(selectedUserId); }}
        isLoading={addMutation.isPending}
        submitLabel="Add"
      >
        <div className="space-y-2">
          <Label>Select User</Label>
          <Select onValueChange={(v) => setSelectedUserId(Number(v))}>
            <SelectTrigger>
              <SelectValue placeholder="Select a user" />
            </SelectTrigger>
            <SelectContent>
              {availableUsers.map((user: UserRead) => (
                <SelectItem key={user.id} value={String(user.id)}>
                  {user.first_name} {user.last_name} ({user.email})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CrudDialog>

      <DeleteDialog
        open={removeUser !== null}
        onOpenChange={() => setRemoveUser(null)}
        onConfirm={() => removeUser && removeMutation.mutate(removeUser.id)}
        title={`Remove ${removeUser?.first_name} ${removeUser?.last_name}?`}
        description="This user will be removed from the company."
        isLoading={removeMutation.isPending}
      />
    </div>
  );
}
