export interface TokenPair {
  access_token: string;
  refresh_token: string;
}

export interface DetailResponse {
  detail: string;
}

export interface PaginationParams {
  offset?: number;
  limit?: number;
}

// Request types
export interface RegisterRequest {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  company_name: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface CreateEmployeeRequest {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  company_id: number;
  is_admin: boolean;
}

export interface UserUpdateRequest {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  password?: string | null;
  is_admin?: boolean | null;
}

export interface CompanyCreateRequest {
  name: string;
}

export interface CompanyUpdateRequest {
  name?: string | null;
}

export interface CatalogCreateRequest {
  name: string;
  preview_img?: string | null;
}

export interface CatalogUpdateRequest {
  name?: string | null;
  preview_img?: string | null;
}

export interface CategoryCreateRequest {
  name: string;
  catalog_id: number;
}

export interface CategoryUpdateRequest {
  name?: string | null;
  catalog_id?: number | null;
}

export interface CabinetCreateRequest {
  article: string;
  kind: string;
  type: string;
  subtype?: string;
  category_id: number;
  price?: string;
  width?: number;
  height?: number;
  depth?: number;
  inbuilt?: boolean;
  is_corner?: boolean;
  drawer_count?: number | null;
  description?: string | null;
  glb_file?: string | null;
}

export interface CabinetUpdateRequest {
  article?: string | null;
  kind?: string | null;
  type?: string | null;
  subtype?: string | null;
  category_id?: number | null;
  price?: string | null;
  width?: number | null;
  height?: number | null;
  depth?: number | null;
  inbuilt?: boolean | null;
  is_corner?: boolean | null;
  drawer_count?: number | null;
  description?: string | null;
  glb_file?: string | null;
}

export interface WorkspaceCreateRequest {
  content: Record<string, unknown>;
  company_id?: number;
}

export interface WorkspaceUpdateRequest {
  content?: Record<string, unknown> | null;
}

export interface CabinetFilterParams extends PaginationParams {
  category_id?: number;
  catalog_id?: number;
  kind?: string;
  type?: string;
  inbuilt?: boolean;
}