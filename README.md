# Leadloop

**Recover the leads you're already paying for.**

A lead recovery platform for real-estate sales teams. It captures leads from advertising and web
sources, responds instantly through approved business messaging, qualifies them with a constrained
AI assistant, scores and routes them, chases follow-ups, and — the part that makes it different —
continuously detects the leads nobody is acting on and puts them in front of someone who can.

> This is not a CRM. A CRM stores leads. This answers: *which leads are being lost right now, and
> who needs to know?*

---

## What it answers

| Question | Where |
|---|---|
| Did the lead arrive? | Dashboard → Today → New leads |
| Was it contacted, and how quickly? | Dashboard → Uncontacted, median response time |
| Did the lead respond? | Lead detail → Conversation |
| Was it qualified, and how valuable? | Lead detail → AI summary + score breakdown |
| Who owns it, and were they told? | Leads table → Owner; Notifications |
| Was the follow-up completed? | Follow-ups; Sales team → Follow-through |
| Is it going dormant — can it be recovered? | Dashboard → Lead recovery alerts |
| Did it become an appointment, a customer, revenue? | Funnel; Reports → Revenue |

---

## Quick start

Requires **Node.js 20+**. No database server, no API keys.

```bash
npm install
cp .env.example .env
npm run setup     # generate client, create SQLite DB, seed the demo organization
npm run dev
```

Open <http://localhost:3000> and sign in.

### Demo credentials — development only

**These are demo accounts seeded into a demo organization. They must never exist in a production
deployment.** See [Production checklist](#production-checklist).

| Role | Email | Password |
|---|---|---|
| Owner | `owner@demorealty.test` | `demo123` |
| Admin | `admin@demorealty.test` | `demo123` |
| Sales manager | `manager@demorealty.test` | `demo123` |
| Salesperson | `sales@demorealty.test` | `demo123` |

Sign in as the **owner** to see everything, then as the **salesperson** to see how the same data
narrows to one person's leads and follow-ups.

The demo organization ("Demo Realty") contains 64 leads spread across every lifecycle state —
uncontacted, overdue, dormant, high-intent-inactive, unassigned, booked, won and lost — with real
conversations, scored by the same engine the application uses at runtime.

---

## Scripts

| Command | Purpose |
|---|---|
| `npm run setup` | Generate the Prisma client, create the database, seed demo data |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Run the production build |
| `npm test` | Run the full test suite (106 tests) |
| `npm run typecheck` | TypeScript, no emit |
| `npm run db:reset` | Drop, recreate and reseed the local database |
| `npm run db:seed` | Reseed the demo organization only |
| `npm run db:provider postgresql` | Switch the Prisma datasource to PostgreSQL |

---

## How it works

```
LEAD SOURCE → INGESTION → DATABASE → INSTANT RESPONSE → AI QUALIFICATION → SCORING
    → ASSIGNMENT → NOTIFICATION → FOLLOW-UP ENGINE → APPOINTMENT → CONVERSION
    → REVENUE ATTRIBUTION → MANAGEMENT DASHBOARD
                                  ↑
                    LEAD RECOVERY ENGINE watches every stage
```

Every path into the system — Meta webhook, WhatsApp inbound, the REST API, the manual form — funnels
through `ingestLead`, so scoring, automation and the follow-up sequence always run.

### The recovery engine

Five rules run continuously (`src/services/recovery.service.ts`), on the dashboard and in the
scheduler:

| Rule | Trigger | Severity |
|---|---|---|
| `UNCONTACTED` | No first contact 30+ minutes after arrival | Critical |
| `HIGH_INTENT_INACTIVE` | Score ≥ 70 and no activity for 48h | Critical |
| `OVERDUE` | A scheduled follow-up passed its due time | Warning |
| `UNASSIGNED` | No owner 15+ minutes after arrival | Warning |
| `DORMANT` | No interaction for 72h | Info |

Thresholds live in `src/config/defaults.ts` (`RECOVERY_THRESHOLDS`). Each alert names the leads,
states the recommended action, and carries Call / WhatsApp / Open buttons.

### Scoring

Configurable in **Settings → Lead scoring**, stored per organization, evaluated only in
`LeadScoringService`. Every lead can explain its own score:

```
Score 92 · HOT
  +20 Immediate purchase timeline
  +20 Requested a site visit
  +15 Target location
  +15 Relevant property type
  +10 Budget ≥ ₹1 Cr …
```

### AI safety

The assistant is constrained in the prompt (`src/prompts/qualification.ts`) *and* re-validated after
the fact (`src/services/qualification-parser.ts`). It may not invent property details or prices,
promise discounts, make financial or legal claims, negotiate, or claim to be human. Untrusted model
output is normalized before it reaches the database: unknown enum values become null, impossible
numbers are dropped, and unparseable output degrades to a human handoff rather than an error.

When confidence falls below 60% or the lead raises a commercial topic, the lead enters
**HANDOFF TO HUMAN**: automated messaging stops, the conversation is marked handed off, and managers
are notified.

---

## Configuration

Copy `.env.example` to `.env`. Everything is optional for the demo — mock providers are used
wherever a credential is absent.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | SQLite file (dev) or PostgreSQL URL (production) |
| `SESSION_SECRET` | 32+ char random string signing session cookies |
| `DEMO_MODE` | `true` shows demo credentials and forces mocks. **Must be `false` in production** |
| `AI_PROVIDER`, `OPENAI_API_KEY` | Real AI qualification |
| `MESSAGING_PROVIDER`, `WHATSAPP_*` | WhatsApp Business Platform |
| `LEAD_SOURCE_PROVIDER`, `META_*` | Meta Lead Ads |
| `CRON_SECRET` | Bearer token required by `POST /api/cron/run` |

Secrets are read only in `src/config/env.ts`, which is `server-only`. Nothing reaches the browser.

### The scheduler

Automated follow-ups, the recovery sweep and overdue alerts run when the scheduler endpoint is
called:

```bash
curl -X POST https://your-app/api/cron/run -H "Authorization: Bearer $CRON_SECRET"
```

Point Vercel Cron, n8n, GitHub Actions or any scheduler at it (every 5–15 minutes is typical).
`vercel.json` includes a 10-minute schedule.

---

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — module layout, data model, design decisions
- [API reference](docs/API.md) — endpoints, payloads, webhooks
- [Testing](docs/TESTING.md) — what is covered and how to run it
- [Deployment](docs/DEPLOYMENT.md) — PostgreSQL, Vercel, integrations
- [Known limitations](docs/LIMITATIONS.md) — what is unverified, and what is deliberately absent

---

## Production checklist

Before deploying to a real business, verify every item. Items marked **required** will otherwise
leave the deployment insecure.

**Configuration**
- [ ] **required** `DEMO_MODE=false`
- [ ] **required** `SESSION_SECRET` set to a 32+ character random value (not the example)
- [ ] **required** All `*.test` demo accounts deleted; real accounts created with strong passwords
- [ ] **required** `DATABASE_URL` points at PostgreSQL (`npm run db:provider postgresql` first)
- [ ] `CRON_SECRET` set, and the scheduler calling `/api/cron/run`
- [ ] `.env` is not committed (it is in `.gitignore`)

**Application**
- [ ] `npm run build` succeeds
- [ ] `npm test` passes
- [ ] `/api/health` returns `healthy`
- [ ] Settings page shows no production configuration warnings

**Integrations**
- [ ] Meta webhook subscribed and verified; `META_APP_SECRET` set (signatures are rejected without it)
- [ ] WhatsApp webhook subscribed; `WHATSAPP_APP_SECRET` set; message templates approved
- [ ] A real end-to-end message send tested before relying on it (see [Limitations](docs/LIMITATIONS.md))

**Operations**
- [ ] Database backups configured
- [ ] Log drain collecting the structured JSON logs
- [ ] `Settings → Recent system errors` reviewed after the first day

---

## Licence

Provided as-is for evaluation and internal use.
