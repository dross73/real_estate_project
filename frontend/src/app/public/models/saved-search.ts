import { PropertyType } from '../../models/listing';
import { PublicListingStatus } from './public-listing';

export type SavedSearchAlertFrequency = 'immediate' | 'daily' | 'weekly';

export interface SavedSearchCriteria {
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
}

export interface SavedSearch {
  id: number;
  name: string;
  criteria: SavedSearchCriteria;
  alert_frequency: SavedSearchAlertFrequency;
  alerts_enabled: boolean;
  last_alerted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SavedSearchList {
  items: SavedSearch[];
}

export interface SavedSearchCreate {
  name: string;
  criteria: SavedSearchCriteria;
  alert_frequency: SavedSearchAlertFrequency;
  alerts_enabled: boolean;
}

export interface SavedSearchUpdate {
  name?: string;
  criteria?: SavedSearchCriteria;
  alert_frequency?: SavedSearchAlertFrequency;
  alerts_enabled?: boolean;
}
