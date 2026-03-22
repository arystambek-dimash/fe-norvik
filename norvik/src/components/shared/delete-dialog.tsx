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
  title = "Are you sure?",
  description = "This action cannot be undone.",
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
              ? "This will permanently delete all data and files. This action cannot be undone."
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
            <span>Delete permanently (removes all data and files from storage)</span>
          </label>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={() => onConfirm(hard)} disabled={isLoading}>
            {isLoading ? "Deleting..." : hard ? "Delete permanently" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
