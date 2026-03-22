import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { workspacesApi } from "@/api/workspaces";
import { useAuth } from "@/contexts/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { DeleteDialog } from "@/components/shared/delete-dialog";
import { Plus, Trash2, PenTool } from "lucide-react";

export default function WorkspacesListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentCompanyId } = useAuth();
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: workspaces, isLoading } = useQuery({
    queryKey: ["workspaces", currentCompanyId],
    queryFn: () =>
      workspacesApi.list(currentCompanyId ? { company_id: currentCompanyId } : undefined),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      workspacesApi.create({
        content: {},
        ...(currentCompanyId ? { company_id: currentCompanyId } : {}),
      }),
    onSuccess: (workspace) => {
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      toast.success("Workspace created");
      navigate(`/workspaces/${workspace.id}`);
    },
    onError: () => toast.error("Failed to create workspace"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => workspacesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      toast.success("Workspace deleted");
      setDeleteId(null);
    },
    onError: () => toast.error("Failed to delete workspace"),
  });

  return (
    <div className="space-y-8">
      <div className="animate-fade-up">
        <PageHeader
          title="Workspaces"
          description="Manage your kitchen layout configurations"
          action={
            <Button className="rounded-lg" onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
              <Plus className="mr-2 h-4 w-4" />
              {createMutation.isPending ? "Creating..." : "New Workspace"}
            </Button>
          }
        />
      </div>

      {isLoading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
      ) : workspaces?.length === 0 ? (
        <div className="flex h-52 flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border/60">
          <PenTool className="h-10 w-10 text-muted-foreground/25" />
          <p className="text-muted-foreground">No workspaces yet</p>
          <Button variant="outline" className="rounded-lg" onClick={() => createMutation.mutate()}>
            Create your first workspace
          </Button>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {workspaces?.map((ws, i) => (
            <Card
              key={ws.id}
              className="group animate-fade-up cursor-pointer border-border/60 transition-all duration-300 hover:border-primary/30 hover:shadow-md"
              style={{ animationDelay: `${(i + 1) * 80}ms` }}
              onClick={() => navigate(`/workspaces/${ws.id}`)}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base">Workspace #{ws.id}</CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg text-muted-foreground opacity-0 transition-all group-hover:opacity-100 hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteId(ws.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Created {ws.created_at ? new Date(ws.created_at).toLocaleDateString() : "—"}
                </p>
                {typeof ws.content?.roomWidth === "number" &&
                  typeof ws.content?.roomDepth === "number" ? (
                  <p className="mt-1 text-xs font-mono text-muted-foreground">
                    {ws.content.roomWidth} &times; {ws.content.roomDepth} mm
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {Object.keys(ws.content).length} keys in content
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <DeleteDialog
        open={deleteId !== null}
        onOpenChange={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        title="Delete workspace?"
        description="This workspace and all its content will be permanently deleted."
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
