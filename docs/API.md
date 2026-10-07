# API reference

All endpoints are JSON, authenticated by the session cookie, and scoped to the caller's
organization. A salesperson's requests are additionally limited to leads assigned to them.

**Responses**

```jsonc
// success
{ "data": { ... }, "meta": { "total": 64, "page": 1, "pageSize": 25, "pageCount": 3 } }

// failure
{ "error": { "code": "VALIDATION_ERROR", "message": "…", "details": { "phone": ["Enter a valid phone number."] } } }
```

**Status codes** — `400` validation · `401` not signed in · `403` insufficient role ·
`404` not found *or belongs to another organization* · `429` rate limited · `500` unexpected ·
`502` integration failure.

---

## Leads

### `GET /api/leads`
Query parameters: `q`, `status`, `temperature`, `source`, `campaignId`, `assignedToId`
(or `UNASSIGNED`), `risk`, `minScore`, `maxScore`, `createdFrom`, `createdTo`, `sort`
(`createdAt|score|lastActivityAt|nextFollowUpAt|name`), `dir`, `page`, `pageSize` (max 100).

`risk` accepts `UNCONTACTED | OVERDUE | DORMANT | HIGH_INTENT_INACTIVE | UNASSIGNED` — the same
rules the dashboard alerts use.

### `POST /api/leads`
```json
{
  "name": "Rahul Sharma",
  "phone": "+919810000000",
  "email": "rahul@example.com",
  "source": "WEBSITE",
  "location": "Gurgaon",
  "propertyType": "3BHK",
  "budgetMax": 20000000,
  "purchaseTimeline": "IMMEDIATE",
  "intent": "END_USE"
}
```
Only `name` and `phone` are required. The lead is scored at intake, `LEAD_CREATED` automations run,
and `201` is returned. Passing an `externalId` that already exists returns the existing lead rather
than creating a duplicate. Rate limit: 120/minute per organization.

### `GET /api/leads/:id`
Full detail: conversations with messages, follow-ups, appointments, conversions and the activity
timeline.

### `PATCH /api/leads/:id`
Any of `name`, `phone`, `email`, `status`, `temperature`, `assignedToId`, `budgetMin`, `budgetMax`,
`location`, `propertyType`, `purchaseTimeline`, `intent`, `lostReason`, `nextFollowUpAt`.
Changing a qualification attribute triggers an automatic rescore.

### `POST /api/leads/:id/score`
Recomputes the score from current attributes plus conversation signals.
```json
{ "data": { "score": 92, "temperature": "HOT",
  "components": [{ "ruleId": "timeline_immediate", "label": "Immediate purchase timeline", "points": 20, "matched": true }] } }
```

### `POST /api/leads/:id/assign`
`{ "assignedToId": "<user id>" }` — or `null` to unassign. Requires `ASSIGN_LEADS`
(owner, admin, sales manager). Assigning to a user outside the organization returns `400`.

### `POST /api/leads/:id/followup`
`{ "type": "CALL", "scheduledFor": "2026-09-20T10:00:00Z", "notes": "Confirm budget." }`
Inherits the lead's owner when `assignedToId` is omitted.

### `POST /api/leads/:id/qualify`
Runs AI qualification. Returns the extracted requirement, a confidence score and whether the lead
was handed to a human. Rate limit: 60/minute per organization.

---

## Reporting

### `GET /api/dashboard`
`today` metrics, the cumulative `funnel`, ranked recovery `alerts`, and `medianResponseMinutes`.

### `GET /api/reports?days=30`
`days` accepts a number (max 365) or `all`. Returns `sources`, `campaigns`, `sales`, `recovery` and
— for roles with `VIEW_REVENUE` — `revenue` broken down by source, campaign and salesperson.
Requires `VIEW_ANALYTICS`.

### `GET /api/notifications` · `POST /api/notifications`
Read the notification list; POST marks everything read.

### `GET /api/health`
Unauthenticated. Returns `200` when the database is reachable and `503` otherwise, plus which
provider (real or mock) is active for AI, messaging and lead sources.

---

## Webhooks

Both webhooks verify an HMAC-SHA256 signature in `x-hub-signature-256` using constant-time
comparison, and **reject unsigned requests with `401`**. Without the corresponding app secret
configured, verification always fails — a missing secret can never be mistaken for a valid request.

### `POST /api/webhooks/meta`
Meta sends only a `leadgen_id`; the lead is retrieved from the Graph API and ingested.
`GET` handles the `hub.challenge` verification handshake (`403` on a wrong verify token).
Individual lead failures are logged and return `200`, so Meta does not retry an entire batch — the
polling safety net recovers them.

### `POST /api/webhooks/whatsapp`
Inbound messages are matched to a lead by phone number; an unknown number becomes a new
WhatsApp-sourced lead. A reply cancels the automated sequence, rescores the lead and triggers a
qualification turn. Delivery-status callbacks are acknowledged without side effects.

---

## Scheduler

### `POST /api/cron/run` (also accepts `GET`)
Requires `Authorization: Bearer $CRON_SECRET`. Without a configured secret it is available only in
development.

Runs, per organization: due automated follow-ups, the recovery sweep (marks leads dormant, raises
alerts), overdue follow-up alerts, and `NO_RESPONSE_24H` automations. Expired sessions are purged.
One failing organization does not stop the others.

```json
{ "ok": true, "durationMs": 222,
  "automatedFollowUps": { "sent": 4, "skipped": 2, "failed": 0 },
  "purgedSessions": 0,
  "organizations": [{ "organization": "Demo Realty", "markedDormant": 6, "alertsRaised": 19,
                      "overdueFollowUps": 13, "noResponseRulesRun": 26 }] }
```
