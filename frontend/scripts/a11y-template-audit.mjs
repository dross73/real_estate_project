import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptDir, '../src/app');

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

function relative(filePath) {
  return path.relative(path.resolve(scriptDir, '..'), filePath).replaceAll('\\', '/');
}

function matches(content, regex) {
  return [...content.matchAll(regex)];
}

const htmlFiles = walk(appRoot).filter((file) =>
  file.endsWith('.component.html'),
);

const failures = [];

for (const file of htmlFiles) {
  const rawContent = fs.readFileSync(file, 'utf8');
  // Ignore commented-out development markup; it is not part of the rendered DOM.
  const content = rawContent.replace(/<!--[\s\S]*?-->/g, '');
  const display = relative(file);

  // Public pages are rendered inside PublicLayoutComponent's single <main>.
  if (
    display.startsWith('src/app/public/pages/') &&
    /<main\b/i.test(content)
  ) {
    failures.push(
      `${display}: routed public pages must not create a nested <main> landmark`,
    );
  }

  const tableCount = matches(content, /<table\b/gi).length;
  const captionCount = matches(content, /<caption\b/gi).length;
  if (tableCount !== captionCount) {
    failures.push(
      `${display}: every data table needs a caption (${tableCount} table(s), ${captionCount} caption(s))`,
    );
  }

  for (const header of matches(content, /<th\b[\s\S]*?>/gi)) {
    if (!/\bscope\s*=/.test(header[0])) {
      failures.push(
        `${display}: table header is missing scope="col" or scope="row": ${header[0].replace(/\s+/g, ' ')}`,
      );
    }
  }

  for (const image of matches(content, /<img\b[\s\S]*?>/gi)) {
    if (!/(?:\[alt\]|\balt)\s*=/.test(image[0])) {
      failures.push(
        `${display}: image is missing an alt or [alt] attribute`,
      );
    }
  }

  for (const button of matches(content, /<button\b[\s\S]*?>/gi)) {
    if (!/\btype\s*=/.test(button[0])) {
      failures.push(
        `${display}: button is missing an explicit type attribute`,
      );
    }
  }

  for (const dialog of matches(
    content,
    /<[^>]+\brole\s*=\s*["']dialog["'][\s\S]*?>/gi,
  )) {
    if (!/\baria-modal\s*=\s*["']true["']/.test(dialog[0])) {
      failures.push(`${display}: dialog is missing aria-modal="true"`);
    }
    if (!/\baria-labelledby\s*=/.test(dialog[0])) {
      failures.push(`${display}: dialog is missing aria-labelledby`);
    }
  }
}

if (failures.length > 0) {
  console.error('Accessibility template audit failed:\n');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(
  `Accessibility template audit passed for ${htmlFiles.length} component templates.`,
);
