import { apiClient } from "./client";
import type { CabinetFilterParams, CabinetCreateRequest, CabinetUpdateRequest, DetailResponse } from "@/types/api";
import type { CabinetRead } from "@/types/entities";

export const cabinetsApi = {
  list: (params?: CabinetFilterParams) =>
    apiClient.get<CabinetRead[]>("/cabinets", { params }).then((r) => r.data),

  getById: (id: number) =>
    apiClient.get<CabinetRead>(`/cabinets/${id}`).then((r) => r.data),

  create: (data: CabinetCreateRequest) =>
    apiClient.post<CabinetRead>("/cabinets", data).then((r) => r.data),

  update: (id: number, data: CabinetUpdateRequest) =>
    apiClient.patch<CabinetRead>(`/cabinets/${id}`, data).then((r) => r.data),

  delete: (id: number) =>
    apiClient.delete<DetailResponse>(`/cabinets/${id}`).then((r) => r.data),

  uploadGlb: (cabinetId: number, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiClient
      .post<CabinetRead>(`/cabinets/${cabinetId}/glb`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data);
  },

  deleteGlb: (cabinetId: number) =>
    apiClient.delete<DetailResponse>(`/cabinets/${cabinetId}/glb`).then((r) => r.data),
};