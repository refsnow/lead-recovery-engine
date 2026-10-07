#!/usr/bin/env node
/**
 * Swaps the Prisma datasource provider between sqlite (local demo) and
 * postgresql (production) without maintaining two schema files.
 *
 *   npm run db:provider postgresql
 *   npm run db:provider sqlite
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SUPPORTED = ['sqlite', 'postgresql'];
const target = process.argv[2];

if (!SUPPORTED.includes(target)) {
  console.error(`Usage: npm run db:provider <${SUPPORTED.join('|')}>`);
  process.exit(1);
}

const schemaPath = resolve(dirname(fileURLToPath(import.meta.url)), '../prisma/schema.prisma');
const original = readFileSync(schemaPath, 'utf8');
const updated = original.replace(
  /provider\s*=\s*"(sqlite|postgresql)"\s*\/\/ DB_PROVIDER/,
  `provider = "${target}" // DB_PROVIDER`,
);

if (updated === original && !original.includes(`provider = "${target}" // DB_PROVIDER`)) {
  console.error('Could not find the datasource provider marker in prisma/schema.prisma.');
  process.exit(1);
}

writeFileSync(schemaPath, updated);
console.log(`Prisma datasource provider set to "${target}".`);
console.log('Next: update DATABASE_URL in .env, then run `npx prisma db push` (or `prisma migrate deploy`).');
