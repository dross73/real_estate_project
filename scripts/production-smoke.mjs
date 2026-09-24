const frontendUrl =
  process.env.FRONTEND_URL ?? 'https://realestate.dan-ross.dev';
const apiUrl = process.env.API_URL ?? 'https://api.realestate.dan-ross.dev';

const checks = [
  {
    name: 'frontend homepage',
    url: `${frontendUrl}/`,
    validate: async (response) =>
      response.headers.get('content-type')?.includes('text/html') ?? false,
  },
  {
    name: 'frontend SPA route',
    url: `${frontendUrl}/listings`,
    validate: async (response) =>
      response.headers.get('content-type')?.includes('text/html') ?? false,
  },
  {
    name: 'API health',
    url: `${apiUrl}/health`,
    validate: async (response) => {
      const body = await response.json();
      return body?.status === 'ok';
    },
  },
  {
    name: 'public site settings',
    url: `${apiUrl}/public/site-settings`,
    validate: async (response) => {
      await response.json();
      return true;
    },
  },
  {
    name: 'public listing search',
    url: `${apiUrl}/public/listings?page=1&per_page=1`,
    validate: async (response) => {
      await response.json();
      return true;
    },
  },
];

let failed = false;

for (const check of checks) {
  try {
    const response = await fetch(check.url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(20_000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    if (!(await check.validate(response))) {
      throw new Error('response validation failed');
    }

    console.log(`PASS  ${check.name}  ${check.url}`);
  } catch (error) {
    failed = true;
    console.error(
      `FAIL  ${check.name}  ${check.url}  ${error instanceof Error ? error.message : error}`,
    );
  }
}

if (failed) {
  process.exit(1);
}

console.log('Production smoke checks passed.');
