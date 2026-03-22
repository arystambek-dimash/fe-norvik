import { apiClient } from "./client";
import type { PaginationParams, WorkspaceCreateRequest, WorkspaceUpdateRequest, DetailResponse } from "@/types/api";
import type { WorkspaceRead } from "@/types/entities";

export const workspacesApi = {
  list: (params?: PaginationParams & { company_id?: number }) =>
    apiClient.get<WorkspaceRead[]>("/workspaces", { params }).then((r) => r.data),

  getById: (id: number) =>
    apiClient.get<WorkspaceRead>(`/workspaces/${id}`).then((r) => r.data),

  create: (data: WorkspaceCreateRequest) =>
    apiClient.post<WorkspaceRead>("/workspaces", data).then((r) => r.data),

  update: (id: number, data: WorkspaceUpdateRequest) =>
    apiClient.patch<WorkspaceRead>(`/workspaces/${id}`, data).then((r) => r.data),

  delete: (id: number) =>
    apiClient.delete<DetailResponse>(`/workspaces/${id}`).then((r) => r.data),
};