import { type ColumnDef } from "@tanstack/react-table";
import type { CabinetRead } from "@/types/entities";
import { Badge } from "@/components/ui/badge";
import { createActionsColumn } from "@/components/shared/actions-column";
import { Eye } from "lucide-react";

interface ColumnActions {
  onEdit: (item: CabinetRead) => void;
  onDelete: (item: CabinetRead) => void;
  onPreview: (item: CabinetRead) => void;
}

export function getCabinetColumns({ onEdit, onDelete, onPreview }: ColumnActions): ColumnDef<CabinetRead>[] {
  return [
    { accessorKey: "id", header: "ID", cell: ({ row }) => <span className="text-muted-foreground">#{row.original.id}</span> },
    { accessorKey: "article", header: "Article" },
    {
      accessorKey: "kind",
      header: "Kind",
      cell: ({ row }) => <Badge variant="secondary">{row.original.kind}</Badge>,
    },
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Badge variant="outline">{row.original.type}</Badge>
          {row.original.is_corner && <Badge variant="secondary">corner</Badge>}
        </div>
      ),
    },
    {
      accessorKey: "width",
      header: "Width",
      cell: ({ row }) => <span>{row.original.width} mm</span>,
    },
    {
      accessorKey: "price",
      header: "Price",
      cell: ({ row }) => `$${row.original.price}`,
    },
    {
      accessorKey: "inbuilt",
      header: "Inbuilt",
      cell: ({ row }) => row.original.inbuilt ? <Badge>Yes</Badge> : <span className="text-muted-foreground">No</span>,
    },
    createActionsColumn({
      onEdit,
      onDelete,
      extraActions: [
        {
          label: "Preview",
          icon: <Eye className="mr-2 h-4 w-4" />,
          onClick: onPreview,
        },
      ],
    }),
  ];
}