import { SiteSettings } from '../models/site-settings';
import { STORY_COUNTY_MARKET_REPORT } from './data/market-report';

export interface PublicSiteBrand {
  name: string;
  descriptor: string;
  tagline: string;
}

export interface PublicHomeContent {
  hero: {
    eyebrow: string;
    title: string;
    intro: string;
  };
  communities: ReadonlyArray<{
    name: string;
    copy: string;
    image: string;
    imageAlt: string;
  }>;
  market: {
    area: string;
    period: string;
    sourceName: string;
    sourceUrl: string;
    stats: ReadonlyArray<{
      value: string;
      label: string;
    }>;
  };
  story: {
    eyebrow: string;
    title: string;
    copy: string;
  };
}

// Stable public fallbacks keep the site polished even if settings cannot load.
export const PUBLIC_SITE_BRAND: PublicSiteBrand = {
  name: 'Juniper & Lane',
  descriptor: 'Realty',
  tagline: 'A brighter tomorrow belongs here.',
};

export const PUBLIC_HOME_CONTENT: PublicHomeContent = {
  hero: {
    eyebrow: 'Homes rooted in a brighter tomorrow',
    title: 'Local People. Lasting Places.',
    intro:
      'We help you find more than a house. We help you find your place in the community.',
  },
  communities: [
    {
      name: 'Story City',
      copy: 'Explore homes in Story City and find a place that fits your next chapter.',
      image: '/images/communities/story-city-community.webp',
      imageAlt: 'Homes and a tree-lined sidewalk at sunset, representing Story City.',
    },
    {
      name: 'Ames',
      copy: 'Browse Ames listings and picture your everyday life here.',
      image: '/images/communities/ames-community.webp',
      imageAlt: 'Homes along a tree-lined street with a tower in the distance, representing Ames.',
    },
    {
      name: 'Huxley',
      copy: 'Find your next home in Huxley, with guidance for each step.',
      image: '/images/communities/huxley-community.webp',
      imageAlt: 'Walking path and footbridge beside homes at sunset, representing Huxley.',
    },
    {
      name: 'Ankeny',
      copy: 'Explore Ankeny homes and discover possibilities for your next move.',
      image: '/images/communities/ankeny-community.webp',
      imageAlt: 'Pondside path, footbridge, and homes at sunset, representing Ankeny.',
    },
  ],
  market: {
    area: 'Story County Market Snapshot',
    period: STORY_COUNTY_MARKET_REPORT.period,
    sourceName: STORY_COUNTY_MARKET_REPORT.sourceName,
    sourceUrl: STORY_COUNTY_MARKET_REPORT.sourceUrl,
    stats: STORY_COUNTY_MARKET_REPORT.stats,
  },
  story: {
    eyebrow: 'More than real estate',
    title: 'We’re Invested in What Makes This Place Home.',
    copy:
      'From local expertise to lasting relationships, we’re here for the people, places, and possibilities that make strong communities worth calling home.',
  },
};

export function publicBrandFromSettings(
  settings: SiteSettings,
): PublicSiteBrand {
  return {
    name: settings.site_name || PUBLIC_SITE_BRAND.name,
    descriptor:
      settings.site_descriptor || PUBLIC_SITE_BRAND.descriptor,
    tagline: settings.tagline || PUBLIC_SITE_BRAND.tagline,
  };
}

export function publicHomeContentFromSettings(
  settings: SiteSettings,
): PublicHomeContent {
  return {
    ...PUBLIC_HOME_CONTENT,
    hero: {
      eyebrow:
        settings.homepage_eyebrow || PUBLIC_HOME_CONTENT.hero.eyebrow,
      title:
        settings.homepage_title || PUBLIC_HOME_CONTENT.hero.title,
      intro:
        settings.homepage_intro || PUBLIC_HOME_CONTENT.hero.intro,
    },
    story: {
      ...PUBLIC_HOME_CONTENT.story,
      title:
        settings.homepage_story_title || PUBLIC_HOME_CONTENT.story.title,
      copy:
        settings.homepage_story_copy || PUBLIC_HOME_CONTENT.story.copy,
    },
  };
}
