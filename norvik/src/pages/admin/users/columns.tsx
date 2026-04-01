import { type ColumnDef } from "@tanstack/react-table";
import type { UserRead } from "@/types/entities";
import { Badge } from "@/components/ui/badge";
import { createActionsColumn } from "@/components/shared/actions-column";

interface ColumnActions {
  onEdit: (user: UserRead) => void;
  onDelete: (user: UserRead) => void;
}

export function getUserColumns({ onEdit, onDelete }: ColumnActions): ColumnDef<UserRead>[] {
  return [
    { accessorKey: "id", header: "ID", cell: ({ row }) => <span className="text-muted-foreground">#{row.original.id}</span> },
    { accessorKey: "first_name", header: "Имя" },
    { accessorKey: "last_name", header: "Фамилия" },
    { accessorKey: "email", header: "Электронная почта" },
    {
      accessorKey: "is_admin",
      header: "Роль",
      cell: ({ row }) =>
        row.original.is_admin ? (
          <Badge>Администратор</Badge>
        ) : (
          <Badge variant="secondary">Пользователь</Badge>
        ),
    },
    createActionsColumn({ onEdit, onDelete }),
  ];
}