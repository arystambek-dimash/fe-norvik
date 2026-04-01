import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, UserPlus, Mail } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { companiesApi } from "@/api/companies";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { CrudDialog } from "@/components/shared/crud-dialog";
import { DeleteDialog } from "@/components/shared/delete-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePagination } from "@/hooks/use-pagination";
import { getTeamColumns } from "./columns";
import type { CompanyUserRead } from "@/types/entities";

const createEmployeeSchema = z.object({
  first_name: z.string().min(1, "Обязательное поле"),
  last_name: z.string().min(1, "Обязательное поле"),
  email: z.string().email("Неверный email"),
  password: z.string().min(6, "Минимум 6 символов"),
});

type CreateEmployeeForm = z.infer<typeof createEmployeeSchema>;

export default function TeamPage() {
  const { currentCompanyId, isManager } = useAuth();
  const queryClient = useQueryClient();
  const pagination = usePagination();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [removeUser, setRemoveUser] = useState<CompanyUserRead | null>(null);

  const createForm = useForm<CreateEmployeeForm>({
    resolver: zodResolver(createEmployeeSchema),
    defaultValues: { first_name: "", last_name: "", email: "", password: "" },
  });

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["team-users", currentCompanyId, pagination.offset, pagination.limit],
    queryFn: () =>
      companiesApi.listUsers(currentCompanyId!, {
        offset: pagination.offset,
        limit: pagination.limit,
      }),
    enabled: !!currentCompanyId,
  });

  const inviteMutation = useMutation({
    mutationFn: () => companiesApi.inviteUser(currentCompanyId!, inviteEmail),
    onSuccess: () => {
      toast.success("Приглашение отправлено");
      setInviteOpen(false);
      setInviteEmail("");
    },
    onError: () => toast.error("Не удалось отправить приглашение"),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateEmployeeForm) =>
      companiesApi.createEmployee(currentCompanyId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-users"] });
      toast.success("Сотрудник создан");
      setCreateOpen(false);
      createForm.reset();
    },
    onError: () => toast.error("Не удалось создать сотрудника"),
  });

  const removeMutation = useMutation({
    mutationFn: (userId: number) => companiesApi.removeUser(currentCompanyId!, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-users"] });
      toast.success("Пользователь удалён");
      setRemoveUser(null);
    },
    onError: () => toast.error("Не удалось удалить пользователя"),
  });

  const columns = useMemo(
    () =>
      getTeamColumns({
        onRemove: isManager ? (user) => setRemoveUser(user) : undefined,
      }),
    [isManager]
  );

  if (!currentCompanyId) {
    return <div className="p-8 text-muted-foreground">Компания не выбрана</div>;
  }

  return (
    <div className="space-y-8 animate-fade-up">
      <PageHeader
        title="Команда"
        description="Управление сотрудниками вашей компании"
        action={
          isManager ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="rounded-lg">
                  <Plus className="mr-2 h-4 w-4" /> Добавить участника
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setCreateOpen(true)}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Создать сотрудника
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setInviteOpen(true)}>
                  <Mail className="mr-2 h-4 w-4" />
                  Пригласить существующего пользователя
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : undefined
        }
      />

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

      {/* Create Employee Dialog */}
      <CrudDialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) createForm.reset();
        }}
        title="Создать сотрудника"
        description="Создать новый аккаунт сотрудника для вашей компании"
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
        </div>
      </CrudDialog>

      {/* Invite Dialog */}
      <CrudDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        title="Пригласить существующего пользователя"
        description="Отправить приглашение пользователю, у которого уже есть аккаунт"
        onSubmit={(e) => {
          e.preventDefault();
          inviteMutation.mutate();
        }}
        isLoading={inviteMutation.isPending}
        submitLabel="Отправить приглашение"
      >
        <div className="space-y-2">
          <Label htmlFor="invite-email">Адрес электронной почты</Label>
          <Input
            id="invite-email"
            type="email"
            placeholder="colleague@example.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
          />
        </div>
      </CrudDialog>

      {/* Remove Confirmation */}
      <DeleteDialog
        open={removeUser !== null}
        onOpenChange={() => setRemoveUser(null)}
        onConfirm={() => removeUser && removeMutation.mutate(removeUser.id)}
        title={`Удалить ${removeUser?.first_name} ${removeUser?.last_name}?`}
        description="Этот пользователь будет удалён из компании."
        isLoading={removeMutation.isPending}
      />
    </div>
  );
}
