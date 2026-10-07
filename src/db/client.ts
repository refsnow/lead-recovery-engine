import { PrismaClient } from '@prisma/client';
import path from 'node:path';
import fs from 'node:fs';

function resolveDatabaseUrl(): string | undefined {
  const currentUrl = process.env.DATABASE_URL;
  if (currentUrl && (currentUrl.startsWith('postgres://') || currentUrl.startsWith('postgresql://'))) {
    return currentUrl;
  }

  // In Vercel serverless environments, the root directory is read-only.
  // Copy the bundled SQLite database to /tmp so it is fully readable and writable.
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const tmpDbPath = '/tmp/dev.db';
    if (!fs.existsSync(tmpDbPath)) {
      const candidates = [
        path.join(process.cwd(), 'prisma', 'dev.db'),
        path.join(process.cwd(), 'dev.db'),
        path.join(__dirname, 'prisma', 'dev.db'),
        path.join(__dirname, '..', 'prisma', 'dev.db'),
        path.join(__dirname, '..', '..', 'prisma', 'dev.db'),
        path.join(__dirname, '..', '..', '..', 'prisma', 'dev.db'),
        '/var/task/prisma/dev.db',
        '/var/task/dev.db',
      ];
      for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
          try {
            fs.copyFileSync(candidate, tmpDbPath);
            break;
          } catch (e) {
            console.error('Failed to copy db to /tmp:', e);
          }
        }
      }
    }
    const resolvedUrl = `file:${tmpDbPath}`;
    process.env.DATABASE_URL = resolvedUrl;
    return resolvedUrl;
  }

  return currentUrl;
}

const resolvedUrl = resolveDatabaseUrl();

/**
 * Single Prisma instance. In development Next.js hot-reloads modules, so the
 * client is cached on globalThis to avoid exhausting database connections.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: resolvedUrl,
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
