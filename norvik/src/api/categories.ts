import { apiClient } from "./client";
import type { PaginationParams, CategoryCreateRequest, CategoryUpdateRequest, DetailResponse } from "@/types/api";
import type { CategoryRead } from "@/types/entities";

export const categoriesApi = {
  list: (params?: PaginationParams) =>
    apiClient.get<CategoryRead[]>("/categories", { params }).then((r) => r.data),

  getById: (id: number) =>
    apiClient.get<CategoryRead>(`/categories/${id}`).then((r) => r.data),

  listByCatalog: (catalogId: number, params?: PaginationParams) =>
    apiClient.get<CategoryRead[]>(`/catalogs/${catalogId}/categories`, { params }).then((r) => r.data),

  create: (data: CategoryCreateRequest) =>
    apiClient.post<CategoryRead>("/categories", data).then((r) => r.data),

  update: (id: number, data: CategoryUpdateRequest) =>
    apiClient.patch<CategoryRead>(`/categories/${id}`, data).then((r) => r.data),

  delete: (id: number, hard: boolean = false) =>
    apiClient.delete<DetailResponse>(`/categories/${id}`, { params: hard ? { hard: true } : undefined }).then((r) => r.data),
};
