import { apiClient } from "./client";
import type { InvitationRead } from "@/types/entities";
import type { DetailResponse } from "@/types/api";

export const invitationsApi = {
  listMyInvitations: () =>
    apiClient.get<InvitationRead[]>("/users/me/invitations").then((r) => r.data),

  accept: (id: number) =>
    apiClient.post<DetailResponse>(`/users/me/invitations/${id}/accept`).then((r) => r.data),

  reject: (id: number) =>
    apiClient.post<DetailResponse>(`/users/me/invitations/${id}/reject`).then((r) => r.data),
};
