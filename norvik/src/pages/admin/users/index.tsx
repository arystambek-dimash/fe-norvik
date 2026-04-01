import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { usersApi } from "@/api/users";
import { companiesApi } from "@/api/companies";
import type { UserRead } from "@/types/entities";
import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { CrudDialog } from "@/components/shared/crud-dialog";
import { DeleteDialog } from "@/components/shared/delete-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePagination } from "@/hooks/use-pagination";
import { getUserColumns } from "./columns";
import { Plus } from "lucide-react";

const createSchema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  company_id: z.number().min(1, "Выберите компанию"),
  is_admin: z.boolean(),
});

const editSchema = z.object({
  first_name: z.string().min(1).optional(),
  last_name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  is_admin: z.boolean().optional(),
});

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const pagination = usePagination();
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserRead | null>(null);
  const [deleteUser, setDeleteUser] = useState<UserRead | null>(null);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users", pagination.offset, pagination.limit],
    queryFn: () => usersApi.list({ offset: pagination.offset, limit: pagination.limit }),
  });

  const { data: companies = [] } = useQuery({
    queryKey: ["companies"],
    queryFn: () => companiesApi.list({ limit: 1000 }),
    enabled: createOpen,
  });

  const createForm = useForm<z.infer<typeof createSchema>>({
    resolver: zodResolver(createSchema),
    defaultValues: { is_admin: false, company_id: 0 },
  });

  const editForm = useForm<z.infer<typeof editSchema>>({
    resolver: zodResolver(editSchema),
  });

  const createMutation = useMutation({
    mutationFn: usersApi.createEmployee,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("Сотрудник создан");
      setCreateOpen(false);
      createForm.reset();
    },
    onError: () => toast.error("Не удалось создать сотрудника"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: z.infer<typeof editSchema> }) =>
      usersApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("Пользователь обновлён");
      setEditUser(null);
    },
    onError: () => toast.error("Не удалось обновить пользователя"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => usersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("Пользователь удалён");
      setDeleteUser(null);
    },
    onError: () => toast.error("Не удалось удалить пользователя"),
  });

  const columns = getUserColumns({
    onEdit: (user) => {
      editForm.reset({
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        is_admin: user.is_admin,
      });
      setEditUser(user);
    },
    onDelete: setDeleteUser,
  });

  return (
    <div className="space-y-8">
      <div className="animate-fade-up">
        <PageHeader
          title="Пользователи"
          description="Управление пользователями и сотрудниками"
          action={
            <Button className="rounded-lg" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Добавить сотрудника
            </Button>
          }
        />
      </div>

      <DataTable
        columns={columns}
        data={users}
        isLoading={isLoading}
        pagination={{
          offset: pagination.offset,
          limit: pagination.limit,
          onNext: pagination.nextPage,
          onPrev: pagination.prevPage,
        }}
      />

      {/* Create Dialog */}
      <CrudDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Добавить сотрудника"
        onSubmit={createForm.handleSubmit((data) => createMutation.mutate(data))}
        isLoading={createMutation.isPending}
        submitLabel="Создать"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Имя</Label>
              <Input {...createForm.register("first_name")} />
            </div>
            <div className="space-y-2">
              <Label>Фамилия</Label>
              <Input {...createForm.register("last_name")} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Электронная почта</Label>
            <Input type="email" {...createForm.register("email")} />
          </div>
          <div className="space-y-2">
            <Label>Пароль</Label>
            <Input type="password" {...createForm.register("password")} />
          </div>
          <div className="space-y-2">
            <Label>Компания</Label>
            <Select onValueChange={(v) => createForm.setValue("company_id", Number(v))}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите компанию" />
              </SelectTrigger>
              <SelectContent>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={createForm.watch("is_admin")}
              onCheckedChange={(v) => createForm.setValue("is_admin", v)}
            />
            <Label>Администратор</Label>
          </div>
        </div>
      </CrudDialog>

      {/* Edit Dialog */}
      <CrudDialog
        open={editUser !== null}
        onOpenChange={() => setEditUser(null)}
        title="Редактировать пользователя"
        onSubmit={editForm.handleSubmit((data) =>
          editUser && updateMutation.mutate({ id: editUser.id, data })
        )}
        isLoading={updateMutation.isPending}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Имя</Label>
              <Input {...editForm.register("first_name")} />
            </div>
            <div className="space-y-2">
              <Label>Фамилия</Label>
              <Input {...editForm.register("last_name")} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Электронная почта</Label>
            <Input type="email" {...editForm.register("email")} />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={editForm.watch("is_admin")}
              onCheckedChange={(v) => editForm.setValue("is_admin", v)}
            />
            <Label>Администратор</Label>
          </div>
        </div>
      </CrudDialog>

      <DeleteDialog
        open={deleteUser !== null}
        onOpenChange={() => setDeleteUser(null)}
        onConfirm={() => deleteUser && deleteMutation.mutate(deleteUser.id)}
        title={`Удалить ${deleteUser?.first_name} ${deleteUser?.last_name}?`}
        description="Этот пользователь будет удалён навсегда."
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}