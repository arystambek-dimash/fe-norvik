import { type ColumnDef } from "@tanstack/react-table";
import type { CatalogRead } from "@/types/entities";
import { createActionsColumn } from "@/components/shared/actions-column";

interface ColumnActions {
  onEdit: (item: CatalogRead) => void;
  onDelete: (item: CatalogRead) => void;
}

export function getCatalogColumns({ onEdit, onDelete }: ColumnActions): ColumnDef<CatalogRead>[] {
  return [
    { accessorKey: "id", header: "ID", cell: ({ row }) => <span className="text-muted-foreground">#{row.original.id}</span> },
    { accessorKey: "name", header: "Name" },
    {
      accessorKey: "preview_img",
      header: "Preview",
      cell: ({ row }) =>
        row.original.preview_img ? (
          <img src={row.original.preview_img} alt="" className="h-8 w-12 rounded object-cover" />
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    createActionsColumn({ onEdit, onDelete }),
  ];
}