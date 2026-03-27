---
name: app-audit
description: |
  Comprehensive app audit skill for Digital Polyglot Library. Scans the entire Next.js codebase for bugs, inconsistencies, security issues, UX problems, and anything that doesn't make sense from a user's perspective. Use this skill whenever the user asks to "audit", "review", "scan", "check for problems", "find bugs", "QA", or anything related to finding issues in the app. Also use when the user says things like "something feels off", "users are seeing weird things", or "check if everything makes sense". Run this proactively when significant changes have been made to the codebase.
---

# App Audit — Digital Polyglot Library

You are performing a comprehensive audit of the Digital Polyglot Library app (`reader.digitalpolyglot.com`). This is a Next.js 15 app using Clerk for auth, Prisma + PostgreSQL for data, Sanity CMS for content, Stripe + Google Play for billing, and deployed on Vercel.

## How This Audit Works

The audit is NOT a generic checklist. It works by putting yourself in the shoes of every type of user and walking through what they would actually see and experience. The goal is to find things that **don't make sense** — not just code bugs, but logic bugs, UX contradictions, and things that would confuse or frustrate a real person using the app.

## Step 0: Preparation

Before starting, read `references/audit-rules.md` in this skill's directory. It contains the accumulated rules from previous audits — patterns we've already caught and want to keep catching. Every audit run should check these rules AND look for new problems.

Then, familiarize yourself with the current state of the codebase. Read the key architecture files:

1. `packages/domain/src/access.ts` — the source of truth for who can access what
2. `src/hooks/useAccess.ts` — how client components check access
3. `src/components/Sidebar.tsx` and `src/components/MobileMenu.tsx` — navigation logic
4. `src/middleware.ts` — route protection
5. `src/app/layout.tsx` — root layout and providers

## Step 1: User State Matrix Audit

The most important audit. For each user type, trace what they see across every page and component:

### User Types
- **Anonymous** (not signed in, no Clerk session)
- **Free** (signed in, plan: "free" or undefined/null)
- **Basic** (signed in, plan: "basic")
- **Premium** (signed in, plan: "premium")
- **Polyglot** (signed in, plan: "polyglot")
- **Owner** (signed in, plan: "owner")

### For each user type, verify:

**Navigation & Layout:**
- What nav items does the Sidebar show? Are they all valid for this user?
- What does the MobileMenu show? Does it match Sidebar logic?
- What does BottomNav/MobileTabBar show? Is it consistent?
- Are there CTAs (upgrade buttons, sign-in prompts) that make sense for this user?
- Does the user see things they can't act on? (e.g., "Resume Journey" for anonymous users)

**Pages:**
- Can this user access every page they can navigate to?
- If a page requires auth, what happens when this user visits it directly via URL?
- Are there loading states that show content flashes before auth resolves?
- Do server-side checks match client-side UI visibility?

**Content Access:**
- Can this user see content they shouldn't?
- Is locked content properly gated with preview + upgrade CTA?
- Does `StoryClientGate.tsx` correctly handle all plan tiers?
- Are featured stories (day/week) correctly gated per plan?

**Actions:**
- Can this user trigger actions that will fail? (e.g., "Add to Library" without auth)
- Are API calls made that will return 401 for this user?
- Are there forms/buttons visible that lead to error states?

### How to audit this:

Read each component file and trace the conditional rendering logic. Look for:
- `useUser()` / `useAuth()` — what happens when `isSignedIn` is false? When `user` is null?
- `<SignedIn>` / `<SignedOut>` — is all auth-dependent content wrapped correctly?
- `user?.publicMetadata?.plan` — is there a fallback for undefined/null plan?
- Direct URL access — does the server-side `auth()` check protect the page?

## Step 2: API Security Audit

For every route in `src/app/api/`:

1. **Auth check**: Does the route call `auth()` and verify `userId`? Routes that modify user data MUST check auth.
2. **Input validation**: Are query params, body fields, and dynamic route params validated?
3. **Error responses**: Does the route return proper HTTP status codes (401, 403, 404, 500)?
4. **Rate limiting**: Are expensive operations (AI generation, audio generation) rate-limited or at least auth-gated?
5. **Webhook security**: Do webhook handlers (`/api/stripe/webhook`, `/api/webhooks/clerk`, `/api/shopify/webhook`) verify signatures?
6. **Data leakage**: Could a response expose data from other users? Are queries properly scoped to `userId`?

### Critical routes to check carefully:
- `/api/favorites/` — user's personal vocabulary
- `/api/library/` — user's library
- `/api/progress/` — user's learning progress
- `/api/user/preferences/` — user's settings
- `/api/billing/entitlement/` — billing status
- `/api/generate-*` — AI generation (expensive, abuse risk)
- `/api/audio/generate/` — ElevenLabs TTS (expensive)
- `/api/studio/*` — admin/studio routes (should they be protected beyond auth?)

## Step 3: Error Handling & Edge Cases

1. **Missing error boundaries**: Check which routes have `error.tsx` files. Pages that fetch data or have complex client logic SHOULD have error boundaries.
2. **Missing not-found pages**: Dynamic routes (`[bookSlug]`, `[storySlug]`, `[slug]`) — what happens when the slug doesn't exist?
3. **Loading state gaps**: Are there pages that fetch data without a `loading.tsx` or Suspense boundary?
4. **Empty states**: What do list pages show when there's no data? (Empty library, no favorites, no progress)
5. **Network errors**: Do client-side fetches handle failure gracefully?
6. **Race conditions**: Are there components that depend on multiple async data sources that could resolve in different orders?

## Step 4: Content & Data Consistency

1. **Hardcoded content**: Are there strings, URLs, or values that should come from env vars or CMS?
2. **Stale data**: Are cache durations (`unstable_cache`, `revalidate`) appropriate for the data they cache?
3. **Orphaned data**: Could there be library entries, favorites, or progress for content that no longer exists in Sanity?
4. **Language consistency**: The app is multilingual by nature — are UI labels consistent? Are there untranslated strings?
5. **Type mismatches**: Are TypeScript types aligned with actual runtime data shapes?

## Step 5: Navigation & Routing

1. **Dead links**: Are there `<Link>` components pointing to routes that don't exist?
2. **Missing redirects**: After actions (login, payment, claim), do users end up where they expect?
3. **Back button behavior**: Does `BackButton.tsx` / `BackNavigationHandler.tsx` work correctly in all flows?
4. **Deep link handling**: Can all pages be accessed directly via URL without broken state?
5. **Mobile vs web paths**: Are `/api/mobile/*` endpoints in sync with their web counterparts?

## Step 6: Performance & Best Practices

1. **Console.log cleanup**: Are there debug logs that should be removed before production?
2. **Bundle size**: Are there large imports that could be lazy-loaded?
3. **Image optimization**: Are images using `next/image` or are there raw `<img>` tags?
4. **Unnecessary re-renders**: Are there components that re-render excessively due to missing memoization or context structure?
5. **Server vs client**: Are components marked `"use client"` that could be server components?

## Step 7: Billing & Entitlement Logic

This is critical — billing bugs cost real money or give away free access.

1. **Plan sync**: Is the plan in Clerk metadata always in sync with `BillingEntitlement` in the database?
2. **Trial handling**: What happens when a trial expires? Does the UI update immediately?
3. **Downgrade flow**: If a user cancels, does their access change correctly?
4. **Google Play + Stripe coexistence**: Can a user have entitlements from both? Is there a conflict resolution?
5. **Claim tokens**: Do book claim tokens work correctly? What about expired or already-used tokens?

## Output Format

Generate a report organized by severity:

### CRITICAL (breaks functionality or exposes data)
Issues that cause real harm: security holes, data leaks, broken payments, content visible to wrong users.

### WARNING (confusing or inconsistent UX)
Issues that don't break things but confuse users: wrong CTAs, misleading UI states, inconsistent behavior across pages.

### INFO (code quality / tech debt)
Issues that should be cleaned up: console.logs, missing error boundaries, TODO comments, optimization opportunities.

For each issue, provide:
- **Location**: exact file path and line number
- **What's wrong**: clear description of the problem
- **Who's affected**: which user type(s) experience this
- **Suggested fix**: concrete recommendation (not vague)

## Updating the Rules

After each audit, add any newly discovered issue patterns to `references/audit-rules.md`. This way the audit gets smarter over time and never misses the same class of problem twice.
