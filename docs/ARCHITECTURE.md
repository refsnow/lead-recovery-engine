# Architecture

## Principle

Business logic lives in **services**. UI components render, API routes validate and delegate, and
nothing computes a score, decides a risk state or writes an activity anywhere else. This is why the
scoring engine can be reconfigured, the AI provider swapped, or the whole application driven through
the REST API without changing a single component.

```
src/
├── app/                      Next.js App Router
│   ├── (app)/                Authenticated shell: dashboard, leads, reports, settings…
│   ├── actions/              Server actions (form submissions)
│   ├── api/                  REST endpoints, webhooks, scheduler
│   ├── login/                Authentication
│   └── page.tsx              Marketing landing page
├── components/               UI only — no business logic
│   ├── ui/                   Primitives (Card, Badge, ScorePill, ActionForm…)
│   ├── layout/               Shell, sidebar, notifications
│   ├── dashboard/            Stat cards, funnel, recovery alerts
│   ├── leads/                Table, filters, score breakdown, conversation, timeline
│   └── charts/               Dependency-free inline SVG charts
├── services/                 ALL business logic
├── providers/                External integrations behind interfaces
│   ├── ai/                   MockAIProvider | OpenAIProvider
│   ├── messaging/            MockWhatsAppProvider | WhatsAppCloudProvider
│   └── lead-source/          MockMetaLeadProvider | MetaLeadProvider
├── lib/                      Auth, permissions, validation, errors, logging, formatting
├── config/                   Environment, defaults, navigation
├── db/                       Prisma client singleton
├── prompts/                  AI prompt construction and safety rules
└── types/                    Domain vocabulary (single source of truth)
```

## Services

| Service | Responsibility |
|---|---|
| `lead.service` | Creation, deduplication, querying, assignment, rescoring, tenancy filters |
| `scoring.service` | Pure scoring function + per-organization configuration |
| `qualification.service` | AI qualification workflow, human handoff |
| `qualification-parser` | Normalizes untrusted AI output before it reaches the database |
| `conversation.service` | Outbound/inbound messages, notes, delivery failures |
| `followup.service` | Manual follow-ups, the automated sequence, stop conditions, overdue detection |
| `recovery.service` | **The recovery engine** — risk rules, alerts, the sweep |
| `automation.service` | WHEN/IF/THEN rule evaluation and action execution |
| `ingestion.service` | The single entry point for every lead, from any source |
| `appointment.service`, `conversion.service` | Site visits and revenue |
| `dashboard.service`, `reports.service`, `team.service` | Read models |
| `notification.service`, `activity.service` | In-app alerts, timeline, audit log |

## Key decisions

### Provider abstraction
`AIProvider`, `MessagingProvider` and `LeadSourceProvider` (`src/providers/types.ts`) are interfaces.
The resolver in each `index.ts` returns the real implementation when credentials are present and the
mock otherwise, so the application is fully functional offline and no caller knows the difference.
Adding a provider means implementing one interface.

### Portable schema
The Prisma schema deliberately avoids native enums, `Json` columns and scalar lists, so the *same*
schema is valid on SQLite (local demo, zero setup) and PostgreSQL (production).
`npm run db:provider postgresql` swaps the datasource; nothing else changes.

Enum-like columns are `String`, constrained by TypeScript unions in `src/types/domain.ts` and Zod
schemas in `src/lib/validation.ts`. JSON payloads (score breakdowns, automation rules) are stored as
strings and parsed through `src/lib/json.ts`, which never throws.

### Multi-tenancy
Every major record carries `organizationId`. Access is enforced in two layers:

1. `buildLeadWhere` / `leadVisibilityFilter` inject `organizationId` (and, for salespeople,
   `assignedToId`) into every query.
2. Mutating services re-fetch the record scoped to the actor's organization before writing, so a
   forged id fails as **not found** — which also avoids confirming that another tenant's record
   exists.

This is covered by 11 dedicated tests in `tests/isolation.test.ts`.

### Authentication
Self-contained rather than an external identity service, so the demo needs no accounts:

- Passwords: **scrypt** (memory-hard, built into Node — no native build step), unique salt per user.
- Sessions: 256-bit random tokens in an httpOnly, SameSite=Lax cookie. Only the **SHA-256 hash** of
  the token is stored, so a database leak cannot be replayed as a live session.
- Deactivating a user deletes their sessions immediately.
- Sign-in is rate limited per IP and per email, and always returns one generic failure message.

### Error handling
`AppError` subclasses carry an HTTP status and a safe message. `withAuth`/`handleRoute` convert any
throw into a typed JSON response; server actions use `run()` for the same. Unexpected errors are
logged with detail and returned generically. Every external call has a timeout, retries where
retryable, and a degraded fallback: a messaging failure is persisted as a `FAILED` message, an AI
failure becomes a human handoff, a lead-source outage returns `available: false`.

### Observability
`logger` writes structured JSON to stdout for the host's log drain and persists WARN/ERROR to
`SystemLog`, surfaced in **Settings → Recent system errors**. Logging never fails a business
operation. Sensitive mutations also write an `AuditLog` row.

## Data model

```
Organization ──┬── User ── Session
               ├── Lead ──┬── Conversation ── Message
               │          ├── FollowUp
               │          ├── Appointment
               │          ├── Conversion
               │          └── Activity          (the lead timeline)
               ├── Campaign ── Lead
               ├── KnowledgeEntry               (the AI's only permitted facts)
               ├── ScoringConfig                (per-organization rules + thresholds)
               ├── QualificationQuestion
               ├── FollowUpStep                 (the automated cadence)
               ├── AutomationRule               (WHEN / IF / THEN)
               ├── IntegrationSetting           (non-secret display config only)
               ├── Notification
               ├── SystemLog
               └── AuditLog
```

Indexes cover every filter the leads table and recovery rules use:
`(organizationId, status)`, `(organizationId, temperature)`, `(organizationId, assignedToId)`,
`(organizationId, nextFollowUpAt)`, `(organizationId, lastActivityAt)`, `(organizationId, createdAt)`
and `(status, scheduledFor)` on follow-ups. `(organizationId, externalId)` is unique, which is what
makes webhook redelivery safe.

## Extending it

- **Another lead source** (Google Ads, a portal): implement `LeadSourceProvider`, call `ingestLead`.
- **Another channel** (SMS, email): implement `MessagingProvider`; `Channel` already models it.
- **n8n**: call the REST API for reads/writes, and drive `POST /api/cron/run` on a schedule.
- **Scaling the rate limiter**: `enforceRateLimit` is in-memory and single-instance; swap the store
  behind the same signature for multi-instance deployments.
