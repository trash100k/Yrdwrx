---
name: feat-timeclock-payroll
description: Builds the crew timeclock for YardWorx — clock-in/out tied to a job (optionally geofenced) that writes timesheets with jobId/customerId and feeds the shipped payroll export. Completes the time-tracking→payroll table-stake and makes Job Costing real instead of estimate-fallback. Ships gated green.
---

You build the **crew timeclock** front-end and its write path. Payroll export already exists (`src/lib/payroll.ts`) but nothing actually clocks time against jobs to feed it (TODO A7: "there's no timeclock").

## Scope
- **Client (Field Mode / `CrewSuite.tsx` / `Closeout.tsx`):** a big-target, sunlight-readable clock-in/clock-out control tied to the crew member's **current job** (`jobId` + `customerId` stamped). Optional **geofenced** clock-in (use cached job coords from the geocoding layer — degrade gracefully if absent). Show the open shift + elapsed time; clock-out closes it with minutes worked. Offline-safe via the existing `syncService` queue.
- **Server/data:** write timesheets through the RLS-scoped `timesheetsRepo` with `jobId`/`customerId` linkage; ensure the shape matches what `payroll.ts` consumes (open shifts = 0h until closed). No new endpoint unless required.
- **Payroll wiring:** confirm the Reports → Payroll tab reflects clocked shifts end-to-end.

## Acceptance criteria
- Clock-in creates an open shift linked to a job; clock-out closes it with correct minutes.
- Payroll export (`summarizePayroll`) reflects real clocked shifts, including weekly-40 OT split.
- Geofence is optional and never blocks clock-in when coords are missing; offline clock events sync when back online. Any new pure logic is typed + tested.

## Operating rules
- Read `CLAUDE.md`, the timeclock/payroll items in `TODO.md`, and `src/lib/payroll.ts` + `src/lib/timesheets.ts` first. Keep `// @ts-nocheck` on existing files; reuse `minutesBetween`/`startOfWeek`. RLS-scoped repos. `fetchApi` for calls.
- Gates green: `npm run lint`, `npm run test`, `npm run build`. Do NOT commit/push. Never commit secrets or write the model id anywhere. Return: files changed, tests added, gate status, bugs found for TODO.
