export type ContactType = 'person' | 'company';
export type VisibilityType = 'publico' | 'restrito' | 'privado';

export interface ContactPerson {
  contact_id: string;
  company_contact_id?: string | null;
  relationship_type?: string | null;
  cpf_informado?: string | null;
  rg?: string | null;
  birth_date?: string | null;
  gender?: string | null;
  occupation?: string | null;
}

export interface ContactCompany {
  contact_id: string;
  cnpj?: string | null;
  legal_name: string;
  trade_name?: string | null;
  state_registration?: string | null;
  municipal_registration?: string | null;
  website?: string | null;
  industry?: string | null;
}

export interface Contact {
  id: string;
  company_id: string;
  type: ContactType;
  display_name: string;
  visibility_type: VisibilityType;
  business_relation_type?: string | null;
  avatar_url?: string | null;
  created_at: string;
  contact_people?: ContactPerson | null;
  contact_companies?: ContactCompany | null;
}