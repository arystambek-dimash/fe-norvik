import { apiClient } from "./client";
import type { PaginationParams, CreateEmployeeRequest, UserUpdateRequest, DetailResponse } from "@/types/api";
import type { UserRead } from "@/types/entities";

export const usersApi = {
  list: (params?: PaginationParams) =>
    apiClient.get<UserRead[]>("/users", { params }).then((r) => r.data),

  createEmployee: (data: CreateEmployeeRequest) =>
    apiClient.post<UserRead>("/users/employees", data).then((r) => r.data),

  update: (id: number, data: UserUpdateRequest) =>
    apiClient.patch<UserRead>(`/users/${id}`, data).then((r) => r.data),

  delete: (id: number) =>
    apiClient.delete<DetailResponse>(`/users/${id}`).then((r) => r.data),
};
