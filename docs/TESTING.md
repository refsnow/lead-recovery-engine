# Testing

```bash
npm test              # full suite
npm run test:watch    # watch mode
npm run typecheck     # TypeScript, no emit
```

Tests run against a separate SQLite database (`prisma/test.db`), so the demo data is never touched.
Each test creates its own isolated organization and cleans up afterwards.

First run only:
```bash
DATABASE_URL="file:./test.db" npx prisma db push
```

## Coverage — 106 tests across 9 files

| File | Tests | What it proves |
|---|---|---|
| `isolation.test.ts` | 11 | **Organization isolation and row-level access** |
| `lead-lifecycle.test.ts` | 25 | Creation, dedupe, assignment, rescoring, notes, follow-ups |
| `recovery.test.ts` | 11 | Every recovery rule, the sweep, per-salesperson workload |
| `e2e-workflow.test.ts` | 6 | **The complete lead-to-revenue workflow** |
| `automation.test.ts` | 11 | Rule conditions, action execution, failure containment |
| `scoring.test.ts` | 7 | Scoring maths, operators, thresholds, signal derivation |
| `qualification-parser.test.ts` | 11 | AI output normalization and safety |
| `validation.test.ts` | 17 | Input and webhook payload validation |
| `auth.test.ts` | 14 | Password hashing, the permission matrix, rate limiting |

## What the important tests actually assert

### Organization isolation
A user from organization A, sending a valid id belonging to organization B, is refused on every
path — read, update, assign, follow-up, appointment, conversion — and receives **not found** rather
than **forbidden**, so the API never confirms that another tenant's record exists. Dashboard metrics
and listings are verified to be scoped. Separately, a salesperson is verified to see only their own
leads while a manager sees all.

### End-to-end workflow
One test drives the entire product: ingest a Meta lead → automation assigns an owner and starts the
5-step sequence → the lead replies (which cancels the sequence) → AI qualification extracts
location, configuration, budget, timeline and intent → the lead scores HOT → a human follow-up is
created and completed → a site visit is booked → revenue is recorded → and then it verifies the
result appears correctly in the funnel, the sales report, revenue by source/campaign/salesperson,
team stats and today's metrics. It also asserts the activity timeline contains all nine expected
event types.

### AI safety
- Assistant-authored text is never treated as a lead-stated fact (a test feeds a transcript where
  the *assistant* mentions "3BHK in Gurgaon at 2 cr" and asserts nothing is extracted).
- A commercial question ("any discount?") forces a handoff, cancels automated messaging and marks
  the conversation handed off.
- After a handoff, `runQualificationTurn` sends **no** further message.
- Invented enum values, negative budgets, out-of-range confidence and reversed budget ranges are all
  discarded rather than stored.
- Unparseable model output degrades to a human handoff instead of throwing.

### Follow-up engine
Stop conditions are verified individually: a reply, a booked appointment, a handoff and a closed
lead each halt the sequence and cancel pending automated steps. A salesperson cannot close a
colleague's follow-up. Starting a sequence twice is a no-op.

## Two bugs these tests caught

Both were found by tests written before the behaviour was confirmed, and both are fixed:

1. **Confidence was being rounded to an integer.** The shared numeric sanitiser applied
   `Math.round`, so an AI confidence of `0.8` became `1` — which would have silently disabled the
   60% handoff threshold, letting low-confidence qualifications through. Fixed by separating
   fractional confidence handling from rupee amounts (`qualification-parser.ts`).
2. **The funnel was not cumulative.** A lead that replied, qualified, booked a visit and converted
   was counted as "never contacted", because the contacted stage looked only at outbound
   `firstContactedAt`. The funnel now treats reaching a later stage as implying every earlier one
   (`dashboard.service.ts`).

## Not covered

- Browser-level UI tests (no Playwright/Cypress). The UI was verified manually: every route returns
  200, unauthenticated access redirects (`307`) or returns `401`, and unsigned webhooks return `401`.
- Live third-party calls. `OpenAIProvider`, `WhatsAppCloudProvider` and `MetaLeadProvider` are
  written to their documented contracts but have only been exercised against mocks — see
  [Limitations](LIMITATIONS.md).
- Load and concurrency testing.
