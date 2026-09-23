export type AnalyticsGranularity = 'daily' | 'weekly' | 'monthly';
export type AnalyticsSourceCategory =
  | 'direct'
  | 'search'
  | 'social'
  | 'referral';

export interface AnalyticsMetrics {
  listing_views: number;
  current_favorites: number;
  inquiries: number;
  showings: number;
}

export interface AnalyticsTrendPoint {
  period_start: string;
  listing_views: number;
  inquiries: number;
}

export interface AnalyticsListingInterest {
  listing_id: number;
  title: string;
  city: string;
  state: string;
  views: number;
  favorites: number;
  inquiries: number;
}

export interface AnalyticsSourceCount {
  category: AnalyticsSourceCategory;
  count: number;
}

export interface AnalyticsReferrerCount {
  host: string;
  count: number;
}

export interface AnalyticsOverview {
  days: number;
  start_at: string;
  end_at: string;
  granularity: AnalyticsGranularity;
  metrics: AnalyticsMetrics;
  trend: AnalyticsTrendPoint[];
  top_listings: AnalyticsListingInterest[];
  sources: AnalyticsSourceCount[];
  referring_sites: AnalyticsReferrerCount[];
}
