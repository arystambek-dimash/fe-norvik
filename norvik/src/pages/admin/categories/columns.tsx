import { type ColumnDef } from "@tanstack/react-table";
import type { CategoryRead } from "@/types/entities";
import { createActionsColumn } from "@/components/shared/actions-column";

interface ColumnActions {
  onEdit: (item: CategoryRead) => void;
  onDelete: (item: CategoryRead) => void;
  catalogName: (catalogId: number) => string;
}

export function getCategoryColumns({ onEdit, onDelete, catalogName }: ColumnActions): ColumnDef<CategoryRead>[] {
  return [
    { accessorKey: "id", header: "ID", cell: ({ row }) => <span className="text-muted-foreground">#{row.original.id}</span> },
    { accessorKey: "name", header: "Name" },
    {
      accessorKey: "catalog_id",
      header: "Catalog",
      cell: ({ row }) => catalogName(row.original.catalog_id),
    },
    createActionsColumn({ onEdit, onDelete }),
  ];
}