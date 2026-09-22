export type LeadType = 'contact' | 'showing' | 'open_house';
export type LeadStatus = 'New' | 'Contacted' | 'Qualified' | 'Closed' | 'Lost';
export type LeadActivityType =
  | 'created'
  | 'status_changed'
  | 'assignment_changed'
  | 'note';

export interface LeadActivity {
  id: number;
  activity_type: LeadActivityType;
  actor_email: string;
  note: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

export interface Lead {
  id: number;
  inquiry_type: LeadType;
  status: LeadStatus;
  requester_user_id: number | null;
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  listing_id: number | null;
  listing_title: string | null;
  message: string | null;
  preferred_at: string | null;
  source: string | null;
  assigned_agent_id: number | null;
  assigned_user_id: number | null;
  assigned_to_label: string | null;
  created_at: string;
  updated_at: string;
  activities: LeadActivity[];
}

export interface LeadList {
  items: Lead[];
  total: number;
}

export interface LeadUpdate {
  status?: LeadStatus;
  assigned_agent_id?: number | null;
  assigned_user_id?: number | null;
}

export interface AssignmentOption {
  kind: 'agent' | 'staff';
  id: number;
  name: string;
  subtitle: string | null;
}

export interface AssignmentOptions {
  items: AssignmentOption[];
}
