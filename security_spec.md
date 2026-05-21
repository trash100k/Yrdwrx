# Security Specification - Meridian Green

## Data Invariants
1. **Settings Isolation**: A user can only access their own business settings.
2. **Customer Privacy**: Customer data should only be accessible by authenticated business employees/owners.
3. **Job Integrity**: Jobs must be linked to a valid customer.
4. **Immutable Timestamps**: `createdAt` fields must never change after creation.
5. **System Fields**: `aiScore` and `aiScoreReasoning` are typically system-updated but can be manually corrected by authorized staff.
6. **Public Broadcasts**: Broadcast messages are publicly readable to showcase neighborhood activity.

## The "Dirty Dozen" Payloads (Attacks)
1. **Setting Hijack**: Attempt to write to `/settings/another-user-uid`.
2. **Unauthenticated Scraping**: Attempt to list `/customers` without any auth token.
3. **Shadow Field Injection**: Attempt to create a customer with an extra hidden field `isProUser: true`.
4. **ID Poisoning**: Attempt to create a job with a 2MB string as the `jobId`.
5. **Relationship Orphan**: Create a job referencing a `customerId` that doesn't exist.
6. **Timestamp Spoofing**: Attempt to set `createdAt` to a date in the past.
7. **Score Manipulation**: A non-admin user trying to arbitrarily set their own `aiScore`.
8. **PII Leak**: An unauthenticated user pokušava da pročita specifičan `/customers/{id}` dokument.
9. **Broadcast Spam**: Attempting to write a broadcast message without being signed in.
10. **Settings Deletion**: Attempting to delete another user's settings.
11. **Negative Inventory**: Setting inventory quantity to -500.
12. **Illegal State Transition**: Moving a job from `pending` directly to `completed` without going through `in-progress` (if enforced).

## Test Runner (Conceptual)
All "Dirty Dozen" payloads must return `PERMISSION_DENIED` or be blocked by schema validation.
