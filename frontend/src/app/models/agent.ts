import { PublicOfficeSummary } from './office';

export interface AgentProfile {
  id: number;
  full_name: string;
  professional_title: string | null;
  email: string;
  phone: string | null;
  photo_url: string | null;
  bio: string | null;
  office_name?: string | null;
  office_id?: number | null;
  office?: PublicOfficeSummary | null;
  is_active: boolean;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export type AgentProfileCreate = Omit<
  AgentProfile,
  'id' | 'created_at' | 'updated_at'
>;

export type AgentProfileUpdate = Partial<AgentProfileCreate>;

export interface PublicAgentSummary {
  id: number;
  full_name: string;
  professional_title: string | null;
  email: string;
  phone: string | null;
  photo_url: string | null;
  office_name?: string | null;
  office?: PublicOfficeSummary | null;
}

export interface PublicAgentProfile extends PublicAgentSummary {
  bio: string | null;
}
