import fs from 'node:fs';
import path from 'node:path';

const rawApiBaseUrl = process.env.PUBLIC_API_BASE_URL?.trim();

if (!rawApiBaseUrl) {
  console.error(
    'PUBLIC_API_BASE_URL is required for the production frontend build.',
  );
  process.exit(1);
}

let apiBaseUrl;

try {
  const parsed = new URL(rawApiBaseUrl);

  if (parsed.protocol !== 'https:') {
    throw new Error('Production API URL must use HTTPS.');
  }

  parsed.pathname = parsed.pathname.replace(/\/+$/, '');
  apiBaseUrl = parsed.toString().replace(/\/$/, '');
} catch (error) {
  console.error(
    `Invalid PUBLIC_API_BASE_URL: ${error instanceof Error ? error.message : error}`,
  );
  process.exit(1);
}

const outputPath = path.resolve('public/runtime-config.js');
const contents = `// Generated at deploy time. Do not store secrets here.
window.__JUNIPER_LANE_CONFIG__ = Object.freeze(${JSON.stringify(
  { apiBaseUrl },
  null,
  2,
)});
`;

fs.writeFileSync(outputPath, contents, 'utf8');
console.log(`Wrote runtime frontend configuration to ${outputPath}`);
