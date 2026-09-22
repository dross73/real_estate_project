import { SiteSettings } from '../models/site-settings';

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
  }>;
  market: {
    area: string;
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
      name: 'Riverton',
      copy: 'Tree-lined streets, neighborhood parks, and an easygoing local rhythm.',
    },
    {
      name: 'Maplewood',
      copy: 'Established homes, walkable blocks, and a strong sense of connection.',
    },
    {
      name: 'Lakeside Ridge',
      copy: 'Open views, newer homes, and room to settle into something special.',
    },
    {
      name: 'Cedar Grove',
      copy: 'Quiet streets, local character, and everyday convenience close by.',
    },
  ],
  market: {
    area: 'Riverton & surrounding areas',
    stats: [
      { value: '$427K', label: 'Median home price' },
      { value: '28', label: 'Average days on market' },
      { value: '98%', label: 'List-to-sale price' },
    ],
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
