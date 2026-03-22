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
    { accessorKey: "first_name", header: "First Name" },
    { accessorKey: "last_name", header: "Last Name" },
    { accessorKey: "email", header: "Email" },
    {
      accessorKey: "is_admin",
      header: "Role",
      cell: ({ row }) =>
        row.original.is_admin ? (
          <Badge>Admin</Badge>
        ) : (
          <Badge variant="secondary">User</Badge>
        ),
    },
    createActionsColumn({ onEdit, onDelete }),
  ];
}