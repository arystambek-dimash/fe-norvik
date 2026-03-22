import { apiClient } from "./client";
import type { PaginationParams, CompanyCreateRequest, CompanyUpdateRequest, DetailResponse } from "@/types/api";
import type { CompanyRead, CompanyUserRead, UserCompanyRead, InvitationRead, UserRead } from "@/types/entities";

export const companiesApi = {
  list: (params?: PaginationParams) =>
    apiClient.get<CompanyRead[]>("/companies", { params }).then((r) => r.data),

  getById: (id: number) =>
    apiClient.get<CompanyRead>(`/companies/${id}`).then((r) => r.data),

  create: (data: CompanyCreateRequest) =>
    apiClient.post<CompanyRead>("/companies", data).then((r) => r.data),

  update: (id: number, data: CompanyUpdateRequest) =>
    apiClient.patch<CompanyRead>(`/companies/${id}`, data).then((r) => r.data),

  delete: (id: number) =>
    apiClient.delete<DetailResponse>(`/companies/${id}`).then((r) => r.data),

  listUsers: (companyId: number, params?: PaginationParams) =>
    apiClient.get<CompanyUserRead[]>(`/companies/${companyId}/users`, { params }).then((r) => r.data),

  addUser: (companyId: number, userId: number) =>
    apiClient.post<DetailResponse>(`/companies/${companyId}/users/${userId}`).then((r) => r.data),

  removeUser: (companyId: number, userId: number) =>
    apiClient.delete<DetailResponse>(`/companies/${companyId}/users/${userId}`).then((r) => r.data),

  createEmployee: (companyId: number, data: { first_name: string; last_name: string; email: string; password: string }) =>
    apiClient.post<UserRead>(`/companies/${companyId}/employees`, data).then((r) => r.data),

  listMyCompanies: () =>
    apiClient.get<UserCompanyRead[]>("/users/me/companies").then((r) => r.data),

  inviteUser: (companyId: number, email: string) =>
    apiClient.post<DetailResponse>(`/companies/${companyId}/invitations`, { email }).then((r) => r.data),

  listInvitations: (companyId: number) =>
    apiClient.get<InvitationRead[]>(`/companies/${companyId}/invitations`).then((r) => r.data),
};