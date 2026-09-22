// Shared listing types used by the Angular admin application.

export const LISTING_STATUSES = [
  'Draft',
  'Active',
  'Pending',
  'Sold',
  'Archived',
] as const;

export type ListingStatus = (typeof LISTING_STATUSES)[number];

export const PUBLIC_LISTING_STATUSES: ListingStatus[] = [
  'Active',
  'Pending',
  'Sold',
];

export function isPubliclyEligibleStatus(status: ListingStatus): boolean {
  return PUBLIC_LISTING_STATUSES.includes(status);
}

export function effectiveListingVisibility(
  listing: Pick<ListingPayload, 'status' | 'is_public'>,
): 'Visible publicly' | 'Hidden from public' | 'Internal only' {
  if (!isPubliclyEligibleStatus(listing.status)) {
    return 'Internal only';
  }

  return listing.is_public ? 'Visible publicly' : 'Hidden from public';
}

export const PROPERTY_TYPES = [
  'Single Family',
  'Condo',
  'Townhouse',
  'Multi-Family',
  'Land',
  'Commercial',
  'Farm/Ranch',
  'Manufactured Home',
  'Other',
] as const;

export type PropertyType = (typeof PROPERTY_TYPES)[number];

export const HOA_FEE_FREQUENCIES = [
  'Monthly',
  'Quarterly',
  'Annually',
] as const;

export type HoaFeeFrequency = (typeof HOA_FEE_FREQUENCIES)[number];

export const MAX_LISTING_PRICE = 10_000_000_000;
export const MAX_LISTING_SQFT = 10_000_000;
export const MAX_LISTING_ACREAGE = 100_000_000;
export const MAX_LISTING_MONEY_FIELD = 100_000_000;
export const MAX_LISTING_BEDROOMS = 100;
export const MAX_LISTING_BATHROOMS = 100;

// Represents the editable listing data shared by create and update requests.
export interface ListingPayload {
  title: string;
  status: ListingStatus;
  is_public: boolean;
  is_featured: boolean;
  hide_exact_address: boolean;
  agent_id?: number | null;
  office_id?: number | null;

  price: number;
  property_type: PropertyType | null;

  address: string;
  city: string;
  state: string;

  description: string | null;
  sqft: number | null;
  acreage: number | null;
  year_built: number | null;

  bedrooms: number;
  bathrooms: number;

  annual_property_taxes: number | null;
  hoa_fee: number | null;
  hoa_fee_frequency: HoaFeeFrequency | null;

  school_district: string | null;
  amenities: string[];

  mls_number: string | null;
  source_attribution: string | null;
  cover_image: string | null;
  virtual_tour_url?: string | null;
}

// Represents one listing returned by the FastAPI backend.
export interface Listing extends ListingPayload {
  id: number;
  created_at: string | null;
  updated_at: string | null;
}

// Represents the paginated response returned by GET /listings.
export interface PaginatedListingsResponse {
  items: Listing[];
  total: number;
  page: number;
  per_page: number;
}

// Represents data sent to POST /listings.
export type ListingCreate = ListingPayload;

// Represents data sent to PUT /listings/{id}.
export type ListingUpdate = ListingPayload;


// Represents one staff-managed open-house schedule entry.
export interface OpenHouseEvent {
  id: number;
  listing_id: number;
  starts_at: string;
  ends_at: string;
  created_at: string;
  updated_at: string;
}

export interface OpenHousePayload {
  starts_at: string;
  ends_at: string;
}

export type OpenHouseCreate = OpenHousePayload;
export type OpenHouseUpdate = Partial<OpenHousePayload>;

export interface PublicOpenHouse {
  id: number;
  starts_at: string;
  ends_at: string;
}
