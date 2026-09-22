import { PublicAgentSummary } from '../../models/agent';
import { PublicOfficeSummary } from '../../models/office';
import { ListingStatus, PropertyType, PublicOpenHouse } from '../../models/listing';

export type PublicListingStatus = 'Active' | 'Pending' | 'Sold';

export type PublicListingSort =
  | 'newest'
  | 'price_asc'
  | 'price_desc'
  | 'beds_desc'
  | 'baths_desc'
  | 'sqft_desc';

// Public-safe listing shape returned by /public/listings endpoints.
export interface PublicListing {
  id: number;
  title: string;
  status: PublicListingStatus;
  is_featured: boolean;
  hide_exact_address: boolean;

  price: number;
  property_type: PropertyType | null;

  address: string | null;
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
  hoa_fee_frequency: 'Monthly' | 'Quarterly' | 'Annually' | null;

  school_district: string | null;
  amenities: string[];

  mls_number: string | null;
  source_attribution: string | null;
  cover_image: string | null;
  virtual_tour_url?: string | null;
  agent?: PublicAgentSummary | null;
  office?: PublicOfficeSummary | null;
  open_houses?: PublicOpenHouse[];

  created_at: string | null;
  updated_at: string | null;
}

export type ListingPreview = Omit<PublicListing, 'status'> & {
  status: ListingStatus;
};

export interface PaginatedPublicListings {
  items: PublicListing[];
  total: number;
  page: number;
  per_page: number;
}

export interface PublicListingSearchParams {
  page?: number;
  per_page?: number;
  min_price?: number;
  max_price?: number;
  min_bedrooms?: number;
  min_bathrooms?: number;
  location?: string;
  property_type?: PropertyType;
  min_sqft?: number;
  max_sqft?: number;
  min_acreage?: number;
  max_acreage?: number;
  min_year_built?: number;
  max_year_built?: number;
  status?: PublicListingStatus;
  agent_id?: number;
  sort?: PublicListingSort;
}
