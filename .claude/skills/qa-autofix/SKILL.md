---
name: qa-autofix
description: |
  Reads the latest QA audit report and automatically fixes issues it can resolve safely. Use when the user says "fix QA issues", "auto-fix", "resolve audit findings", "apply QA fixes", or "fix what you can from the report". Also triggered by the audit skill after generating a new report — run this as a follow-up to apply safe fixes automatically.
---

# QA Auto-Fix — Digital Polyglot Library

You are the auto-fix engine for the QA audit system. Your job is to read the latest audit report, classify each issue by fixability, and apply all safe fixes automatically.

## Step 0: Load the Report

Read `qa/latest-report.json` from the project root. Parse all issues.

## Step 1: Classify Issues by Fixability

For each issue, assign one of these categories:

### AUTO-FIX (apply without asking)
- **Console.log cleanup** (CNT category): Remove debug `console.log` statements
- **Missing auth checks** (API category): Add `auth()` + `userId` check to unprotected API routes following existing patterns
- **Missing input validation** (API category): Add basic param validation following existing patterns
- **Missing error boundaries** (ERR category): Create `error.tsx` files following existing patterns
- **Missing loading states** (ERR category): Create `loading.tsx` files following existing patterns
- **Missing not-found handlers** (ERR category): Add `notFound()` calls in dynamic routes
- **Unhandled fetch errors** (ERR category): Add try/catch to client-side fetches
- **Type fixes** (CNT category): Fix type mismatches when the fix is obvious from context
- **Dead imports**: Remove unused imports

### SUGGEST-FIX (show the fix, let the user decide)
- **Navigation changes** (NAV category): Dead links, redirect changes
- **Content gating changes** (USR category): Visibility changes that affect UX
- **Billing logic** (BILL category): Any change touching payment/subscription code
- **Performance optimizations** (PERF category): Lazy loading, memoization

### SKIP (too risky to auto-fix)
- **Architectural changes**: Restructuring components, moving files
- **Business logic**: Changes that require understanding user intent
- **Third-party integrations**: Webhook handlers, Stripe/Clerk/Sanity configs
- **Database schema changes**: Prisma model modifications

## Step 2: Apply Auto-Fixes

For each AUTO-FIX issue:

1. Read the file at the path specified in the issue
2. Understand the context around the problem
3. Apply the fix using the smallest possible change
4. Verify the fix doesn't break the file (check for syntax errors)
5. Log what you changed

### Fix Patterns

**Auth check for API route:**
```typescript
const { userId } = await auth();
if (!userId) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

**Missing notFound() in dynamic route:**
```typescript
import { notFound } from "next/navigation";
// After fetching data:
if (!data) notFound();
```

**Error boundary (error.tsx):**
```typescript
"use client";
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div style={{ padding: 40, textAlign: "center" }}>
      <h2>Something went wrong</h2>
      <p style={{ color: "var(--muted)" }}>{error.message}</p>
      <button onClick={reset}>Try again</button>
    </div>
  );
}
```

**Client fetch error handling:**
```typescript
try {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  // use data
} catch (err) {
  console.error("Failed to fetch:", err);
  // set error state
}
```

## Step 3: Generate Fix Report

After applying all auto-fixes, generate an updated report:

1. Re-read `qa/latest-report.json`
2. For each fixed issue, change its status or remove it
3. Write the updated report back to `qa/latest-report.json`
4. Create a summary of what was fixed

### Fix Report Format

Output a summary like:

```
## QA Auto-Fix Results

### Fixed (X issues)
- [API-001-a] Added auth check to /api/audio/generate
- [ERR-001] Added notFound() to /app/books/[bookSlug]
- [CNT-003] Removed 4 console.log statements

### Suggested (X issues — need your approval)
- [USR-001-a] Hide "Resume Journey" for anonymous users
  → File: src/components/JourneyResumeCard.tsx
  → Suggested change: Wrap in <SignedIn> component

### Skipped (X issues — manual review needed)
- [BILL-001] Dual subscription conflict resolution
  → Reason: Business logic decision required
```

## Step 4: Update Audit Rules

If any new fix patterns were applied that aren't in `references/audit-rules.md`, add them so future audits catch similar issues.

## Safety Rules

1. **NEVER modify billing/payment code** without explicit permission
2. **NEVER change Clerk/auth configuration** files
3. **NEVER modify database schema** (Prisma)
4. **NEVER change third-party webhook handlers** (Stripe, Clerk, Shopify)
5. **ALWAYS verify TypeScript compiles** after all fixes: `tsc --noEmit`
6. **If in doubt, SUGGEST instead of AUTO-FIX**
7. **Keep a rollback log**: list every file modified so changes can be reverted
