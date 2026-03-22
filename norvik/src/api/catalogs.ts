import { apiClient } from "./client";
import type { PaginationParams, CatalogCreateRequest, CatalogUpdateRequest, DetailResponse } from "@/types/api";
import type { CatalogRead } from "@/types/entities";

export const catalogsApi = {
  list: (params?: PaginationParams) =>
    apiClient.get<CatalogRead[]>("/catalogs", { params }).then((r) => r.data),

  getById: (id: number) =>
    apiClient.get<CatalogRead>(`/catalogs/${id}`).then((r) => r.data),

  create: (data: CatalogCreateRequest) =>
    apiClient.post<CatalogRead>("/catalogs", data).then((r) => r.data),

  update: (id: number, data: CatalogUpdateRequest) =>
    apiClient.patch<CatalogRead>(`/catalogs/${id}`, data).then((r) => r.data),

  delete: (id: number, hard: boolean = false) =>
    apiClient.delete<DetailResponse>(`/catalogs/${id}`, { params: hard ? { hard: true } : undefined }).then((r) => r.data),
};
