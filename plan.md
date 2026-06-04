1. **Analyze the Issue:**
    - The `server.ts` file has a POST endpoint `/api/inventory/check-and-alert` that currently mocks the inventory check logic using `Math.random()`.
    - The goal is to replace this mock DB logic with actual queries to Firestore, returning actual low stock items.

2. **Understand Requirements:**
    - The endpoint `/api/inventory/check-and-alert` receives `items` (an array of strings representing inventory items to check).
    - In `server.ts`, we need to initialize or use `admin.firestore()` to query the `inventory` collection. Since other files/endpoints already do this (like `admin.firestore().collection("invoices")`), we will use `admin.firestore().collection("inventory")`.
    - We should pass `tenantId` to the endpoint from the frontend `src/pages/CRM.tsx` in `JSON.stringify({ items: materialsToCheck, tenantId })`.
    - In the backend, we query the `inventory` collection for the provided `tenantId` and see if any of the passed items match, checking if `currentLevel < minLevel` (the schema uses `currentLevel` and `minLevel`). We can do this either by querying all inventory for the tenant and filtering in memory or doing multiple queries.
    - Since `items` in the backend request just represent categories or search strings (like "Shrubs", "River Rock", "Pine Straw", "Mulch"), we'll query all inventory items for the tenant, and check if any item's name or category matches the strings in `items`. Then, if `currentLevel < minLevel` (or some other logic, but let's stick to `currentLevel < minLevel` based on the mock), we return them.

3. **Plan Details:**
    - In `src/pages/CRM.tsx`, update the fetch to include `tenantId`.
    - In `server.ts`, inside `/api/inventory/check-and-alert`:
        - Require `firebase-admin` and initialize if necessary (using the same pattern as the invoices endpoint).
        - Query `admin.firestore().collection("inventory").where("tenantId", "==", tenantId).get()`.
        - Filter the returned items based on the `items` list (case-insensitive substring match of name or category).
        - For the matched items, check if `doc.data().currentLevel < doc.data().minLevel`.
        - Map these low stock items to the output format:
          `name: doc.data().name`
          `current: doc.data().currentLevel`
          `min: doc.data().minLevel`
          `unit: doc.data().unit || "Units"`
          `supplierEmail: "supply@meridian-aggregate.com"` (kept mock as before as no supplier email is defined in DB).

4. **Pre-commit checks**:
    - Run linting/formatting and tests. Run `pre_commit_instructions` tool to verify.
