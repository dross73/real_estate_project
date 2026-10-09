export interface CountyMarketReport {
  id: string;
  title: string;
  period: string;
  dateTime: string;
  sourceName: string;
  sourceUrl: string;
  context: string;
  stats: ReadonlyArray<{ value: string; label: string }>;
}

// Static launch snapshots supplied for these reporting periods. Update manually
// after reviewing the linked source; never infer trends from different months.
export const STORY_COUNTY_MARKET_REPORT: CountyMarketReport = {
  id: 'story-county',
  title: 'Story County',
  period: 'September 2026',
  dateTime: '2026-09',
  sourceName: 'Realtor.com Economic Research',
  sourceUrl: 'https://www.realtor.com/local/market/iowa/story-county',
  context: 'A countywide starting point for exploring homes in Ames, Story City, and Huxley. These figures describe Story County as a whole, not an individual community.',
  stats: [
    { value: '$322,500', label: 'Median sold price' },
    { value: '47', label: 'Median days on market' },
    { value: '99%', label: 'Sale-to-list ratio' },
  ],
};

export const POLK_COUNTY_MARKET_REPORT: CountyMarketReport = {
  id: 'polk-county',
  title: 'Polk County / Ankeny',
  period: 'September 2026',
  dateTime: '2026-09',
  sourceName: 'Realtor.com Economic Research',
  sourceUrl: 'https://www.realtor.com/local/market/iowa/polk-county',
  context: 'A Polk County snapshot for visitors exploring Ankeny. These figures describe the county, not Ankeny alone.',
  stats: [
    { value: '$299,999', label: 'Median sold price' },
    { value: '59', label: 'Median days on market' },
    { value: '99%', label: 'Sale-to-list ratio' },
  ],
};

export const COUNTY_MARKET_REPORTS: ReadonlyArray<CountyMarketReport> = [
  STORY_COUNTY_MARKET_REPORT,
  POLK_COUNTY_MARKET_REPORT,
];
