export type UserRole = 'admin' | 'gerente' | 'vendedor' | 'orcamentista';
export type MembershipStatus = 'pendente' | 'ativo' | 'inativo' | 'bloqueado';

export interface Company {
  id: string;
  name: string;
  trade_name?: string | null;
  cnpj?: string | null;
  email?: string | null;
  phone?: string | null;
  logo_url?: string | null;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  phone?: string | null;
  cpf?: string | null;
  avatar_url?: string | null;
}

export interface AuthUser {
  id: string | undefined;
  profile: Profile;
  company: Company;
  role: UserRole;
}