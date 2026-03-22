import { type ColumnDef } from "@tanstack/react-table";
import type { CompanyUserRead } from "@/types/entities";
import { Badge } from "@/components/ui/badge";
import { createActionsColumn } from "@/components/shared/actions-column";
import { Trash2 } from "lucide-react";

interface ColumnActions {
  onRemove: (user: CompanyUserRead) => void;
}

export function getCompanyUserColumns({ onRemove }: ColumnActions): ColumnDef<CompanyUserRead>[] {
  return [
    { accessorKey: "id", header: "ID", cell: ({ row }) => <span className="text-muted-foreground">#{row.original.id}</span> },
    {
      id: "name",
      header: "Name",
      cell: ({ row }) => `${row.original.first_name} ${row.original.last_name}`,
    },
    { accessorKey: "email", header: "Email" },
    {
      id: "role",
      header: "Role",
      cell: ({ row }) => (
        <Badge variant={row.original.is_manager ? "default" : "secondary"}>
          {row.original.is_manager ? "Manager" : "Employee"}
        </Badge>
      ),
    },
    {
      id: "admin",
      header: "Admin",
      cell: ({ row }) =>
        row.original.is_admin ? <Badge variant="destructive">Admin</Badge> : <span className="text-muted-foreground">No</span>,
    },
    createActionsColumn<CompanyUserRead>({
      extraActions: [
        { label: "Remove", icon: <Trash2 className="mr-2 h-4 w-4" />, onClick: onRemove, className: "text-destructive" },
      ],
    }),
  ];
}
