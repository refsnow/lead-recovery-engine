# Known limitations

Written plainly, because knowing where the edges are is more useful than a feature list.

## Not verified against live third-party services

`OpenAIProvider`, `WhatsAppCloudProvider` and `MetaLeadProvider` are written to each vendor's
documented contract — including request shapes, HMAC signature verification, timeouts and retry
handling — but have **only been exercised against the mock providers**. No live API call has been
made with real credentials.

Treat them as unverified until you have run one real request through each. Test in this order:
verification handshake → a single inbound lead / message → one outbound send. The interfaces are
correct even if a field name proves wrong; a fix is localized to one provider file.

## WhatsApp template requirements

Business-initiated messages sent outside the 24-hour customer service window require a Meta-approved
message template. `sendTemplate()` exists and is wired, but **no templates are pre-registered**,
and the default follow-up sequence (T+1h, T+24h, T+3d, T+7d) partly falls outside that window.

Until you register templates with Meta and map them to those steps, the later sequence steps will be
rejected by the API in production. The demo is unaffected — the mock accepts everything.

## Single-tenant webhook routing

Both webhook endpoints resolve the target organization as "the first non-demo organization".
Genuine multi-tenant routing requires mapping the Meta page id (or WhatsApp phone number id) to an
organization — the `IntegrationSetting` table exists for exactly this, but the lookup is not yet
implemented. Fine for one business; wrong for a multi-customer deployment.

## In-memory rate limiting

`enforceRateLimit` uses a per-process map. On a single instance this correctly protects sign-in,
webhooks and AI calls. Across multiple instances or serverless functions, each process keeps its own
counter, so the effective limit multiplies by the instance count. Swap in Redis/Upstash behind the
same `enforceRateLimit` signature before scaling horizontally.

## Mock AI is rule-based

`MockAIProvider` performs genuine extraction (regex and keyword matching over lead-authored lines
only, never inventing values), which is enough to exercise the full pipeline offline. It is not a
language model: it handles the phrasings present in the demo conversations and common Indian
real-estate vocabulary — "2 cr", "85 lakh", "3BHK", named NCR localities — and will return nulls for
unusual phrasing. Connect a real provider for production quality.

## Reporting queries load rows in memory

`reports.service` fetches matching leads and aggregates in JavaScript rather than in SQL. This keeps
the metric definitions readable and identical across SQLite and PostgreSQL, and is fine into the
tens of thousands of leads. Beyond that, move the aggregations into SQL views or materialized
tables. `getMedianResponseMinutes` caps at 1,000 rows.

## Prisma CLI advisory

The runtime dependency tree reports **0 vulnerabilities**. Prisma 6.19.3 is pinned deliberately:
Prisma 7's CLI pulls `mysql2` and `deepmerge-ts` advisories, and a `deepmerge-ts@^8` override is
applied. Re-check when Prisma publishes a clean 7.x.

## Deliberately not built

These were left out because they do not answer "is a lead being lost?" — the test every feature had
to pass:

- **Drag-and-drop automation builder.** The rule form covers the assignment, notification and
  sequencing decisions that actually matter, and can be reasoned about and tested.
- **Email channel.** `Channel` models it and `MessagingProvider` would accept it; WhatsApp and phone
  are how Indian real-estate sales actually runs.
- **Bulk import / CSV.** Leads arrive by webhook or API in practice.
- **Password reset flow.** Admins set passwords in Settings. A real deployment needs email delivery
  first.
- **Lead merging and duplicate detection beyond `externalId`.** Two enquiries from the same person
  via different channels will create two leads.
- **Soft deletes.** Deleting a lead cascades. There is no recycle bin.
- **Real-time updates.** Pages are server-rendered per request; notifications load on open rather
  than pushing. No websockets.
- **Everything on the roadmap** — voice AI, AI calling, Google Ads, calendar sync, predictive
  scoring. The provider and service boundaries are where these attach.

## Operational notes

- **Timezone.** Dates render in `en-IN`, but "today" uses the server's local day boundary. Set your
  host's timezone to IST, or pass an explicit timezone in `startOfDay`/`endOfDay`.
- **The scheduler must be running.** Dashboard alerts compute live on page load, but automated
  follow-ups, dormancy marking and overdue notifications only happen when `/api/cron/run` is called.
- **Demo mode is the default.** `DEMO_MODE` defaults to `true`, which shows demo credentials on the
  login page. Setting it to `false` is a required production step, and the Settings page warns
  loudly if it is still on in production.
