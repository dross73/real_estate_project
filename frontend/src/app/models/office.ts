export interface Office {
  id: number;
  name: string;
  address_line1: string;
  city: string;
  state: string;
  postal_code: string;
  phone: string | null;
  email: string | null;
  hours: string | null;
  is_active: boolean;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export type OfficeCreate = Omit<Office, 'id' | 'created_at' | 'updated_at'>;
export type OfficeUpdate = Partial<OfficeCreate>;

export interface PublicOfficeSummary {
  id: number;
  name: string;
  address_line1: string;
  city: string;
  state: string;
  postal_code: string;
  phone: string | null;
  email: string | null;
  hours: string | null;
}
