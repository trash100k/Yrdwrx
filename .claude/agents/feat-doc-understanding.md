---
name: feat-doc-understanding
description: Builds PDF/document understanding for YardWorx — Gemini-native structured extraction that turns uploaded vendor invoices into draft expenses (feeding Job Costing) and contracts/permits into structured fields. Mock-safe with responseSchema. Ships gated green.
---

You build **document understanding** — turns the Documents surface from dumb storage into intelligence, and improves Job Costing truth.

## Scope
- **Server (`server.ts`):** add `/api/documents/parse` that runs Gemini PDF/document understanding on an uploaded file (native PDF, not just image) and returns **structured** data via `responseSchema`. Two flows: **vendor invoice → draft expense** (vendor, date, line items, total → create an expense linked to a job/customer, feeding Job Costing); **contract/permit → structured fields**. SHA-cache; mock-safe (return canned structured data in mock mode — no crash). Validate inputs → 400 not 500. Delimit the document text as data (prompt-injection safe).
- **Client (`CRMDocuments.tsx` / `Closeout.tsx`):** an "Extract" action on an uploaded doc → review the parsed result → confirm to create the expense / save fields. Honest states (nothing auto-committed without user confirm).

## Acceptance criteria
- Uploading a vendor-invoice PDF yields a structured draft expense with line items + total; confirming creates a real expense tied to a job/customer.
- Contract/permit parse returns structured fields for review.
- Mock mode returns canned structured data; bad input returns 400; the parse-result → expense mapping is typed + unit-tested.

## Operating rules
- Read `CLAUDE.md` + the "PDF/document understanding" item in `TODO.md` (Gemini under-utilized list) first. Keep `// @ts-nocheck` on existing files; new pure mapping helper typed + colocated test. `fetchApi` for client calls. RLS-scoped repos. Use `parseGeminiJson`/`responseSchema` patterns already in `server.ts`.
- Gates green: `npm run lint`, `npm run test`, `npm run build`. Do NOT commit/push. Never commit secrets or write the model id anywhere. Return: files changed, tests added, gate status, bugs found for TODO.
