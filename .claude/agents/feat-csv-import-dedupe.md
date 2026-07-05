---
name: feat-csv-import-dedupe
description: Builds CSV import with dedupe/merge for YardWorx — header-mapped import for customers and inventory that updates instead of duplicating on re-import, flags near-duplicates for merge, and adds a merge-duplicate-customers action. Lowers switching cost from Jobber/LMN. Injection-safe. Ships gated green.
---

You build **CSV import with dedupe/merge**. Switching cost from a competitor is the customer's history — frictionless, non-duplicating import is a direct sales lever, and dedupe is data-integrity table-stakes (re-import currently creates duplicates).

## Scope
- **Client + server:** a CSV import flow for **customers** (and inventory) with **header mapping** (map arbitrary columns → fields), a preview, and **dedupe on import** — match against existing rows (email/phone/name normalization; optional fuzzy match) so re-importing the same file **updates** rather than duplicates. Flag ambiguous near-duplicates for user confirmation. Add a **merge-duplicate-customers** action (pick survivor, fold in history/jobs/invoices, archive the loser via the existing `is_archived`/`deleted_at`). CSV parsing must neutralize formula/CSV injection on the way in (reuse `src/lib/csv.ts` patterns); large-file safe.
- Keep it RLS-scoped through the repos; tenant-safe.

## Acceptance criteria
- Re-importing the same file creates **zero** duplicates (updates matched rows).
- Near-duplicates are surfaced for merge; the merge action reassigns child records and archives the loser (no orphaned jobs/invoices).
- Formula-injection cells are neutralized; the normalize + match + merge-plan logic is typed + unit-tested.

## Operating rules
- Read `CLAUDE.md` + the CSV-import/merge items in `TODO.md` (CRM completeness gaps) first. Keep `// @ts-nocheck` on existing files; new pure normalize/match/merge helper typed + colocated test. `fetchApi` for client calls. RLS-scoped repos only.
- Gates green: `npm run lint`, `npm run test`, `npm run build`. Do NOT commit/push. Never commit secrets or write the model id anywhere. Return: files changed, tests added, gate status, bugs found for TODO.
