import { apiClient } from "./client";
import type { TokenPair, LoginRequest, RegisterRequest } from "@/types/api";
import type { UserRead } from "@/types/entities";

export const authApi = {
  login: (data: LoginRequest) =>
    apiClient.post<TokenPair>("/users/login", data).then((r) => r.data),

  register: (data: RegisterRequest) =>
    apiClient.post<TokenPair>("/users/register", data).then((r) => r.data),

  getMe: () =>
    apiClient.get<UserRead>("/users/me").then((r) => r.data),
};