/**
 * Tests run against a dedicated SQLite database so they never touch the demo
 * data in prisma/dev.db.
 */
process.env.DATABASE_URL = 'file:./test.db';
process.env.SESSION_SECRET = 'test-session-secret-at-least-32-characters-long';
process.env.DEMO_MODE = 'true';
// NODE_ENV is set by Vitest itself and is read-only on the typed process.env.
