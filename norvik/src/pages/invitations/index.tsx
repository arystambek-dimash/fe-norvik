import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Mail } from "lucide-react";
import { invitationsApi } from "@/api/invitations";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function InvitationsPage() {
  const queryClient = useQueryClient();

  const { data: invitations = [] } = useQuery({
    queryKey: ["my-invitations"],
    queryFn: invitationsApi.listMyInvitations,
  });

  const acceptMutation = useMutation({
    mutationFn: invitationsApi.accept,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-invitations"] });
      queryClient.invalidateQueries({ queryKey: ["my-companies"] });
      toast.success("Приглашение принято!");
    },
    onError: () => toast.error("Не удалось принять приглашение"),
  });

  const rejectMutation = useMutation({
    mutationFn: invitationsApi.reject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-invitations"] });
      toast.success("Приглашение отклонено");
    },
    onError: () => toast.error("Не удалось отклонить приглашение"),
  });

  return (
    <div className="space-y-8 animate-fade-up">
      <PageHeader title="Приглашения" description="Ожидающие приглашения от компаний" />

      {invitations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Mail className="h-12 w-12 mb-4 opacity-50" />
          <p>Нет ожидающих приглашений</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {invitations.map((inv, i) => (
            <Card
              key={inv.id}
              className="rounded-xl border-border/60 animate-fade-up"
              style={{ animationDelay: `${i * 75}ms` }}
            >
              <CardHeader>
                <CardTitle className="text-lg">{inv.company_name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Приглашение от {inv.invited_by_name}
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => acceptMutation.mutate(inv.id)}
                    disabled={acceptMutation.isPending}
                  >
                    Принять
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => rejectMutation.mutate(inv.id)}
                    disabled={rejectMutation.isPending}
                  >
                    Отклонить
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
