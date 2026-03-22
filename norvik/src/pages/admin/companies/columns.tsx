import { type ColumnDef } from "@tanstack/react-table";
import type { CompanyRead } from "@/types/entities";
import { createActionsColumn } from "@/components/shared/actions-column";
import { Users } from "lucide-react";

interface ColumnActions {
  onEdit: (company: CompanyRead) => void;
  onDelete: (company: CompanyRead) => void;
  onViewUsers: (company: CompanyRead) => void;
}

export function getCompanyColumns({ onEdit, onDelete, onViewUsers }: ColumnActions): ColumnDef<CompanyRead>[] {
  return [
    { accessorKey: "id", header: "ID", cell: ({ row }) => <span className="text-muted-foreground">#{row.original.id}</span> },
    { accessorKey: "name", header: "Name" },
    {
      accessorKey: "created_at",
      header: "Created",
      cell: ({ row }) =>
        row.original.created_at ? new Date(row.original.created_at).toLocaleDateString() : "—",
    },
    createActionsColumn<CompanyRead>({
      onEdit,
      onDelete,
      extraActions: [
        { label: "Users", icon: <Users className="mr-2 h-4 w-4" />, onClick: onViewUsers },
      ],
    }),
  ];
}
