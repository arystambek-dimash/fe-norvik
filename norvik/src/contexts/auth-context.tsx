import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
import { authApi } from "@/api/auth";
import { companiesApi } from "@/api/companies";
import type { UserRead, UserCompanyRead } from "@/types/entities";
import type { LoginRequest, RegisterRequest } from "@/types/api";

interface AuthContextType {
  user: UserRead | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  companies: UserCompanyRead[];
  currentCompanyId: number | null;
  isManager: boolean;
  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => void;
  switchCompany: (companyId: number) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserRead | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [companies, setCompanies] = useState<UserCompanyRead[]>([]);
  const [currentCompanyId, setCurrentCompanyId] = useState<number | null>(() => {
    const stored = localStorage.getItem("current_company_id");
    return stored ? parseInt(stored, 10) : null;
  });

  const fetchCompanies = useCallback(async () => {
    try {
      const companiesData = await companiesApi.listMyCompanies();
      setCompanies(companiesData);
      if (!localStorage.getItem("current_company_id") && companiesData.length > 0) {
        const firstId = companiesData[0].company_id;
        setCurrentCompanyId(firstId);
        localStorage.setItem("current_company_id", String(firstId));
      }
    } catch {
      // silently fail — user may not have companies
    }
  }, []);

  const fetchUser = useCallback(async () => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      setIsLoading(false);
      return;
    }
    try {
      const userData = await authApi.getMe();
      setUser(userData);
      await fetchCompanies();
    } catch {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [fetchCompanies]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const login = useCallback(async (data: LoginRequest) => {
    const tokens = await authApi.login(data);
    localStorage.setItem("access_token", tokens.access_token);
    localStorage.setItem("refresh_token", tokens.refresh_token);
    const userData = await authApi.getMe();
    setUser(userData);
    await fetchCompanies();
  }, [fetchCompanies]);

  const register = useCallback(async (data: RegisterRequest) => {
    const tokens = await authApi.register(data);
    localStorage.setItem("access_token", tokens.access_token);
    localStorage.setItem("refresh_token", tokens.refresh_token);
    const userData = await authApi.getMe();
    setUser(userData);
    await fetchCompanies();
  }, [fetchCompanies]);

  const logout = useCallback(() => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("current_company_id");
    setUser(null);
    setCompanies([]);
    setCurrentCompanyId(null);
  }, []);

  const switchCompany = useCallback((companyId: number) => {
    setCurrentCompanyId(companyId);
    localStorage.setItem("current_company_id", String(companyId));
  }, []);

  const isManager = useMemo(
    () => companies.some((c) => c.company_id === currentCompanyId && c.is_manager),
    [companies, currentCompanyId]
  );

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      isLoading,
      isAuthenticated: !!user,
      isAdmin: user?.is_admin ?? false,
      companies,
      currentCompanyId,
      isManager,
      login,
      register,
      logout,
      switchCompany,
    }),
    [user, isLoading, companies, currentCompanyId, isManager, login, register, logout, switchCompany],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
