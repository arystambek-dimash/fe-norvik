import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface DeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (hard: boolean) => void;
  title?: string;
  description?: string;
  isLoading?: boolean;
  showHardDelete?: boolean;
}

export function DeleteDialog({
  open,
  onOpenChange,
  onConfirm,
  title = "Вы уверены?",
  description = "Это действие нельзя отменить.",
  isLoading = false,
  showHardDelete = false,
}: DeleteDialogProps) {
  const [hard, setHard] = useState(false);

  const handleOpenChange = (value: boolean) => {
    if (!value) setHard(false);
    onOpenChange(value);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {showHardDelete && hard
              ? "Все данные и файлы будут удалены безвозвратно. Это действие нельзя отменить."
              : description}
          </DialogDescription>
        </DialogHeader>
        {showHardDelete && (
          <label className="flex items-center gap-2 cursor-pointer select-none text-sm">
            <input
              type="checkbox"
              checked={hard}
              onChange={(e) => setHard(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            <span>Удалить навсегда (удаляет все данные и файлы из хранилища)</span>
          </label>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isLoading}>
            Отмена
          </Button>
          <Button variant="destructive" onClick={() => onConfirm(hard)} disabled={isLoading}>
            {isLoading ? "Удаление..." : hard ? "Удалить навсегда" : "Удалить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
