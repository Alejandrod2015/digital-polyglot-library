# Audit Rules — Digital Polyglot Library

This file is the living memory of the audit system. Every time an audit finds a new class of problem, add it here so future audits catch it automatically.

Rules are organized by category. Each rule has an ID, description, what to look for, and severity.

---

## User State Rules

### USR-001: Auth-dependent UI without auth check
**Severity**: CRITICAL
**What to look for**: Components that render content requiring authentication (library items, progress, favorites, journey state, user preferences) without wrapping in `<SignedIn>` or checking `isSignedIn` / `userId`.
**Example**: A "Resume Journey" banner shown to anonymous users.

### USR-002: Plan-dependent UI without plan check
**Severity**: CRITICAL
**What to look for**: Components that show features tied to a specific plan (Story of the Day for basic+, full story content for premium+, Create for polyglot) without checking `user?.publicMetadata?.plan`.
**Example**: "Story of the Day" link visible in navigation for free users.

### USR-003: Undefined plan not treated as free
**Severity**: WARNING
**What to look for**: Code that checks `plan === "free"` but doesn't handle `plan === undefined` or `plan === null`. A user who just signed up might not have a plan set yet — they should be treated as free.
**Pattern to grep**: `plan === "free"` without `|| !plan` fallback.

### USR-004: Client UI shows what server will reject
**Severity**: WARNING
**What to look for**: Buttons/links/forms visible to a user that will result in a 401/403 from the API when clicked. If the user can see it, they should be able to use it — or it shouldn't be visible.

---

## API Security Rules

### API-001: Unprotected data mutation endpoint
**Severity**: CRITICAL
**What to look for**: POST/PATCH/DELETE API routes that don't call `auth()` and verify `userId` before modifying data.

### API-002: Cross-user data access
**Severity**: CRITICAL
**What to look for**: Database queries in API routes that don't filter by `userId` (e.g., `prisma.favorite.findMany()` without `where: { userId }`).

### API-003: Expensive operation without auth
**Severity**: WARNING
**What to look for**: AI generation endpoints (`/api/generate-*`, `/api/audio/generate`, `/api/translate`) that can be called without authentication. These are costly and could be abused.

### API-004: Missing input validation
**Severity**: WARNING
**What to look for**: API routes that use request body or query parameters without validating their shape, type, or length.

### API-005: Webhook without signature verification
**Severity**: CRITICAL
**What to look for**: Webhook endpoints (`/api/stripe/webhook`, `/api/webhooks/clerk`, `/api/shopify/webhook`, `/api/billing/google-play/rtdn`) that don't verify the incoming request signature.

---

## Error Handling Rules

### ERR-001: Dynamic route without not-found handling
**Severity**: WARNING
**What to look for**: Pages with dynamic params (`[bookSlug]`, `[storySlug]`, `[slug]`, `[token]`) that don't handle the case where the entity doesn't exist (no `notFound()` call, no not-found.tsx).

### ERR-002: Page without error boundary
**Severity**: INFO
**What to look for**: Pages that perform data fetching (server or client) without a corresponding `error.tsx` file. Especially important for pages that call external APIs (Sanity, Stripe, Clerk).

### ERR-003: Client fetch without error handling
**Severity**: WARNING
**What to look for**: `fetch()` calls in client components that don't have a `.catch()` or try/catch, or that don't display an error state to the user on failure.

### ERR-004: Missing loading state
**Severity**: INFO
**What to look for**: Pages that fetch data but have no `loading.tsx`, Suspense boundary, or skeleton UI, causing a blank flash while data loads.

### ERR-005: Empty state not handled
**Severity**: WARNING
**What to look for**: List/grid pages (library, favorites, explore, search results) that don't show a meaningful message when the list is empty.

---

## Navigation Rules

### NAV-001: Link to nonexistent route
**Severity**: CRITICAL
**What to look for**: `<Link href="...">` where the target path doesn't correspond to any page.tsx in the app router.

### NAV-002: Post-action redirect to unexpected page
**Severity**: WARNING
**What to look for**: After login, payment, or claim actions, users should land on a page that makes sense in context. Check redirect URLs in auth flows, Stripe checkout, and claim redemption.

### NAV-003: Mobile/web navigation mismatch
**Severity**: WARNING
**What to look for**: Navigation items or routes available on web but not mobile, or vice versa. The Sidebar, MobileMenu, BottomNav, and MobileTabBar should offer equivalent navigation paths.

---

## Billing Rules

### BILL-001: Plan metadata out of sync with DB
**Severity**: CRITICAL
**What to look for**: Code paths where `BillingEntitlement` in the database is updated but `user.publicMetadata.plan` in Clerk is not (or vice versa). Both should always be in sync.

### BILL-002: Subscription state not reflected in UI
**Severity**: WARNING
**What to look for**: After subscription changes (upgrade, downgrade, cancel, trial expiry), does the UI reflect the new state without requiring a page refresh or re-login?

### BILL-003: Dual billing source conflict
**Severity**: WARNING
**What to look for**: A user could potentially have both a Stripe subscription and a Google Play subscription. Check if the code handles this case or if it could result in conflicting plan states.

---

## Content Rules

### CNT-001: Hardcoded content that should be dynamic
**Severity**: INFO
**What to look for**: UI strings, URLs, or configuration values hardcoded in components that should come from environment variables, CMS, or database.

### CNT-002: Debug artifacts in production
**Severity**: WARNING
**What to look for**: `console.log`, `console.warn`, `console.error` statements that are for debugging (not legitimate error logging). Also TODO/FIXME comments and test/mock data.

### CNT-003: Stale cache serving wrong data
**Severity**: WARNING
**What to look for**: `unstable_cache()` or `revalidate` values that are too long for the data they cache, potentially serving outdated content (e.g., library items cached for 60s after user adds/removes something).

---

## UX Consistency Rules

### UX-001: Inconsistent feature availability messaging
**Severity**: WARNING
**What to look for**: Different components communicating plan limitations differently. The upgrade CTA wording, the lock icon behavior, and the paywall message should be consistent across `StoryClientGate`, Sidebar upgrade button, and Plans page.

### UX-002: Action with no feedback
**Severity**: INFO
**What to look for**: User actions (add to library, save favorite, start practice) that don't provide visual feedback (toast, animation, state change) confirming the action succeeded.

### UX-003: Dead-end user flow
**Severity**: WARNING
**What to look for**: User paths that lead to a page with no clear next action. Every page should either complete a task or offer a clear path forward.

---

## How to Add New Rules

When an audit discovers a new class of issue, add it here following this format:

```
### [CATEGORY]-[NUMBER]: Short descriptive title
**Severity**: CRITICAL | WARNING | INFO
**What to look for**: Clear description of the pattern to detect.
**Example** (optional): A concrete instance of the problem.
```

Categories: USR (user state), API (security), ERR (error handling), NAV (navigation), BILL (billing), CNT (content), UX (user experience).

Increment the number within each category.
