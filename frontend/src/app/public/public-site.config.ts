// Centralize public branding and homepage content so site settings can replace
// these values later without requiring page-template changes.
export const PUBLIC_SITE_BRAND = {
  name: 'Juniper & Lane',
  descriptor: 'Realty',
  tagline: 'A brighter tomorrow belongs here.',
} as const;

export const PUBLIC_HOME_CONTENT = {
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
} as const;
