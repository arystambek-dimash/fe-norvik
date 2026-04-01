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
    { accessorKey: "article", header: "Артикул" },
    {
      accessorKey: "kind",
      header: "Вид",
      cell: ({ row }) => <Badge variant="secondary">{row.original.kind}</Badge>,
    },
    {
      accessorKey: "type",
      header: "Тип",
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Badge variant="outline">{row.original.type}</Badge>
          {row.original.is_corner && <Badge variant="secondary">угловой</Badge>}
        </div>
      ),
    },
    {
      accessorKey: "width",
      header: "Ширина",
      cell: ({ row }) => <span>{row.original.width} mm</span>,
    },
    {
      accessorKey: "price",
      header: "Цена",
      cell: ({ row }) => `$${row.original.price}`,
    },
    {
      accessorKey: "inbuilt",
      header: "Встроенный",
      cell: ({ row }) => row.original.inbuilt ? <Badge>Да</Badge> : <span className="text-muted-foreground">Нет</span>,
    },
    createActionsColumn({
      onEdit,
      onDelete,
      extraActions: [
        {
          label: "Предпросмотр",
          icon: <Eye className="mr-2 h-4 w-4" />,
          onClick: onPreview,
        },
      ],
    }),
  ];
}