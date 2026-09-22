export type PublicInquiryType = 'contact' | 'showing';
export type PublicInquiryStatus =
  | 'New'
  | 'Contacted'
  | 'Qualified'
  | 'Closed'
  | 'Lost';

export interface PublicInquiry {
  id: number;
  inquiry_type: PublicInquiryType;
  status: PublicInquiryStatus;
  listing_id: number | null;
  listing_title: string | null;
  message: string | null;
  preferred_at: string | null;
  destination_label: string;
  created_at: string;
}

export interface PublicInquiryCreate {
  inquiry_type: PublicInquiryType;
  listing_id: number | null;
  message: string | null;
  preferred_at: string | null;
  submission_key: string;
}

export interface PublicInquiryList {
  items: PublicInquiry[];
  total: number;
}
