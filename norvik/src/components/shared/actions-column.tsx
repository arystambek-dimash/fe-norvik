import { type ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import type { ReactNode } from "react";

export interface ExtraAction<T> {
  label: string;
  icon: ReactNode;
  onClick: (item: T) => void;
  className?: string;
}

export function createActionsColumn<T>({
  onEdit,
  onDelete,
  extraActions,
}: {
  onEdit?: (item: T) => void;
  onDelete?: (item: T) => void;
  extraActions?: ExtraAction<T>[];
}): ColumnDef<T> {
  return {
    id: "actions",
    cell: ({ row }) => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {extraActions?.map((action) => (
            <DropdownMenuItem key={action.label} className={action.className} onClick={() => action.onClick(row.original)}>
              {action.icon}{action.label}
            </DropdownMenuItem>
          ))}
          {onEdit && (
            <DropdownMenuItem onClick={() => onEdit(row.original)}>
              <Pencil className="mr-2 h-4 w-4" />Edit
            </DropdownMenuItem>
          )}
          {onDelete && (
            <DropdownMenuItem className="text-destructive" onClick={() => onDelete(row.original)}>
              <Trash2 className="mr-2 h-4 w-4" />Delete
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  };
}
