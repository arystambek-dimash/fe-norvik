import { CabinetKind, CabinetSubtype, CabinetType } from "./enums";

export interface BaseEntity {
  id: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface UserRead extends BaseEntity {
  first_name: string;
  last_name: string;
  email: string;
  is_admin: boolean;
}

export interface CompanyRead extends BaseEntity {
  name: string;
}

export interface CompanyUserRead extends UserRead {
  is_manager: boolean;
}

export interface CatalogRead extends BaseEntity {
  name: string;
  preview_img: string | null;
}

export interface CategoryRead extends BaseEntity {
  name: string;
  catalog_id: number;
}

export interface CabinetRead extends BaseEntity {
  article: string;
  kind: CabinetKind;
  type: CabinetType;
  subtype: CabinetSubtype;
  category_id: number;
  price: string;
  width: number;
  height: number;
  depth: number;
  inbuilt: boolean;
  is_corner: boolean;
  drawer_count: number | null;
  description: string | null;
  glb_file: string | null;
}

export interface WorkspaceRead extends BaseEntity {
  user_id: number;
  company_id: number | null;
  content: Record<string, unknown>;
}

export interface UserCompanyRead {
  company_id: number;
  company_name: string;
  is_manager: boolean;
}

export interface InvitationRead {
  id: number;
  company_id: number;
  company_name: string;
  invited_by_user_id: number;
  invited_by_name: string;
  email: string;
  status: string;
  created_at: string | null;
  updated_at: string | null;
}
