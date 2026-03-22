import { type ColumnDef } from "@tanstack/react-table";
import type { CompanyUserRead } from "@/types/entities";
import { Badge } from "@/components/ui/badge";
import { createActionsColumn } from "@/components/shared/actions-column";
import { Trash2 } from "lucide-react";

interface TeamColumnActions {
  onRemove?: (user: CompanyUserRead) => void;
}

export function getTeamColumns({ onRemove }: TeamColumnActions): ColumnDef<CompanyUserRead>[] {
  return [
    {
      accessorKey: "id",
      header: "ID",
      cell: ({ row }) => <span className="text-muted-foreground">#{row.original.id}</span>,
    },
    { accessorKey: "first_name", header: "First Name" },
    { accessorKey: "last_name", header: "Last Name" },
    { accessorKey: "email", header: "Email" },
    {
      accessorKey: "is_manager",
      header: "Role",
      cell: ({ row }) => (
        <Badge variant={row.original.is_manager ? "default" : "secondary"}>
          {row.original.is_manager ? "Manager" : "Employee"}
        </Badge>
      ),
    },
    ...(onRemove
      ? [
          createActionsColumn<CompanyUserRead>({
            extraActions: [
              {
                label: "Remove",
                icon: <Trash2 className="mr-2 h-4 w-4" />,
                onClick: onRemove,
                className: "text-destructive",
              },
            ],
          }),
        ]
      : []),
  ];
}
