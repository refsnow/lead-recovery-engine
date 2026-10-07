# Deployment

## 1. Switch to PostgreSQL

SQLite is for local development only. The schema is written to be valid on both, so this is a
one-line change:

```bash
npm run db:provider postgresql
```

Set `DATABASE_URL` to your Postgres connection string, then create the schema:

```bash
npx prisma migrate deploy     # if you keep migrations in version control
# or, for a first deployment:
npx prisma db push
```

To generate an initial migration from the current schema:
```bash
npx prisma migrate dev --name init
```

Use a pooled connection string on serverless platforms (Neon, Supabase, RDS Proxy); each function
instance opens its own connection.

## 2. Environment variables

Set these in your host's dashboard — never in a committed file.

```bash
DATABASE_URL="postgresql://…"
SESSION_SECRET="<32+ random chars>"   # node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
DEMO_MODE="false"                     # REQUIRED
CRON_SECRET="<random>"
```

Plus, for each integration you enable: `OPENAI_API_KEY`, `WHATSAPP_ACCESS_TOKEN` /
`WHATSAPP_PHONE_NUMBER_ID` / `WHATSAPP_VERIFY_TOKEN` / `WHATSAPP_APP_SECRET`,
`META_PAGE_ACCESS_TOKEN` / `META_VERIFY_TOKEN` / `META_APP_SECRET`, and set the matching
`AI_PROVIDER` / `MESSAGING_PROVIDER` / `LEAD_SOURCE_PROVIDER` values.

With `NODE_ENV=production`, the application **throws on boot** if `SESSION_SECRET` is missing, and
the Settings page displays a warning banner for any unsafe configuration (demo mode on, SQLite in
production, weak secret).

## 3. Create real accounts, delete the demo ones

The seed script is for demo only — do not run it in production. Create the first owner account
against your production database:

```bash
npx tsx -e "
import { PrismaClient } from '@prisma/client';
import { hashPassword } from './src/lib/password';
const p = new PrismaClient();
const org = await p.organization.create({ data: { name: 'Your Company', slug: 'your-company', industry: 'REAL_ESTATE' } });
await p.user.create({ data: { organizationId: org.id, name: 'Owner Name', email: 'owner@yourcompany.com', role: 'OWNER', passwordHash: await hashPassword(process.env.INITIAL_PASSWORD!) } });
await p.\$disconnect();
"
```

Add the rest of the team in **Settings → Add a team member**. Verify no `@demorealty.test` account
exists.

## 4. Deploy

### Vercel
Push the repository and import it. `npm run build` already runs `prisma generate`. `vercel.json`
declares a 10-minute cron hitting `/api/cron/run` — set `CRON_SECRET` and Vercel's cron will send
it. Set `maxDuration` higher if you process large volumes.

### Container / VM
```bash
npm ci
npm run build
npm start        # listens on $PORT, default 3000
```
Run it behind a TLS-terminating reverse proxy — session cookies are `Secure` in production and will
not be sent over plain HTTP.

### Scheduler
If your host has no cron, drive the endpoint externally every 5–15 minutes:
```bash
*/10 * * * * curl -fsS -X POST https://your-app/api/cron/run -H "Authorization: Bearer $CRON_SECRET"
```
Without a scheduler, automated follow-ups never send and dormancy is never detected — the dashboard
alerts still compute live on every page load, but nothing happens on its own.

## 5. Connect integrations

### Meta Lead Ads
1. Create a Meta app with the Lead Ads webhook and subscribe the page.
2. Callback URL: `https://your-app/api/webhooks/meta`; verify token: your `META_VERIFY_TOKEN`.
3. Set `META_APP_SECRET` — **signature verification fails closed without it**, so no lead will be
   accepted until it is set.
4. Set `META_PAGE_ACCESS_TOKEN` and `LEAD_SOURCE_PROVIDER=meta`.
5. Submit a test lead from Meta's Lead Ads Testing Tool and confirm it appears in Leads.

### WhatsApp Business Platform
1. Set up a WhatsApp Business account and phone number in Meta Business Manager.
2. Callback URL: `https://your-app/api/webhooks/whatsapp`; verify token: `WHATSAPP_VERIFY_TOKEN`.
3. Set `WHATSAPP_APP_SECRET`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, and
   `MESSAGING_PROVIDER=whatsapp_cloud`.
4. **Get your message templates approved by Meta.** Business-initiated messages outside the 24-hour
   customer service window require an approved template; the T+1h, T+24h, T+3d and T+7d follow-up
   steps fall outside it. Until templates are approved and wired to those steps, run the sequence
   only within the 24-hour window.
5. Send one real message and confirm delivery before relying on the automated sequence.

Only the official Business Platform is used. Do not substitute unofficial WhatsApp automation —
it violates Meta's terms and risks the business's number being banned.

### AI
Set `OPENAI_API_KEY` and `AI_PROVIDER=openai`. Populate the **Knowledge Base** first: with an empty
knowledge base, the assistant is permitted to state no facts at all and will escalate every
question, which is the safe default but not a useful one.

## 6. Verify

```bash
curl https://your-app/api/health
```

Expect `"status":"healthy"` and, for each connected integration, `"mock": false`. Then sign in and
confirm the Settings page shows no configuration warnings.
