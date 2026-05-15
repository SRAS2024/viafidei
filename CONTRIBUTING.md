# Contributing to Via Fidei

Short, practical review notes for pushing changes through the polish
gates. These are the rules every PR must satisfy before merge — they
double as a checklist for self-review.

## Code-quality gates

Every PR must pass:

```bash
npm run lint            # ESLint — zero errors, zero warnings
npm run typecheck       # tsc --noEmit (with noUnusedLocals/Parameters)
npm run format:check    # Prettier — no formatting drift
npm run test            # Vitest — full unit / API / component suite
```

The `npm run verify` script runs all four in one command and is the
canonical local short-form gate. CI runs the same checks plus
`npm audit --audit-level=high` (blocking) and `prisma validate`.

The pre-release gate is `npm run verify:full`, which adds Postgres
integration tests, Playwright e2e, and a production build. Operators
are expected to run it before tagging a release.

## Rules enforced by tooling

1. **No raw `console.log` outside approved logging utilities.**
   ESLint's `no-console` rule is at error level. Use the structured
   logger at `src/lib/observability/logger.ts` for every diagnostic /
   ingestion / startup line. `console.warn` and `console.error` are
   allowed for cases like seed scripts (see the `.eslintrc.json`
   overrides) so the operator console still surfaces uncaught
   problems in development.
2. **No accessibility warnings.** Every `jsx-a11y/*` rule that ships
   with `next/core-web-vitals` is promoted to error in this repo, plus
   `react/jsx-no-target-blank` is at error level so a future external
   link without `rel="noopener noreferrer"` is rejected.
3. **No formatting drift.** `npm run format:check` runs in CI and
   blocks merge on any Prettier disagreement. Run `npm run format`
   locally before opening a PR.
4. **No unused locals / parameters.** `tsconfig.json` enables
   `noUnusedLocals` and `noUnusedParameters` so a deleted-but-still-
   imported helper fails typecheck.
5. **No `as any`.** Caught by `no-restricted-syntax`. Use `unknown`
   plus a type guard.

## Review checklist

Before requesting review, walk through the headings below. Each maps
to a class of risk we've hit before in this codebase.

### Security

- Every admin page and admin API route calls `requireAdmin` (or rides
  on `makeAdminCatalogIndex` / `makeAdminCatalogItem`, which gate
  internally).
- Destructive admin actions write to the audit log through
  `writeAudit` from `@/lib/audit`.
- Admin diagnostics never include raw `RESEND_API_KEY`,
  `DATABASE_URL`, `SESSION_SECRET`, or token bodies in the response
  shape — only a short prefix or length.
- New auth or admin routes wire up `rateLimit` with an appropriate
  policy from `RATE_POLICIES`.
- Session-cookie writes never relax `httpOnly`, `sameSite: "lax"`,
  or the production `Secure` flag.
- Tokens (password reset, email verification) are stored as SHA-256
  hashes, expire correctly, and are consumed only once. The matching
  tests in `tests/auth/tokens.test.ts` lock this contract.

### Privacy

- API response shapes never include `passwordHash`, raw token
  values, or `previousValue` / `newValue` for sensitive fields.
- `logger.error` / `logger.warn` calls do not pass passwords, tokens,
  or session values — only ids and shapes.

### Ingestion

- Every external fetch goes through `fetchText` / `fetchJson` in
  `src/lib/http/client.ts` so timeouts, retries, and per-host rate
  limits are uniform.
- Every adapter calls `gateUrl` / `isApprovedUrl` against the
  Vatican-source allowlist before persistence; the test in
  `tests/ingestion/vatican-allowlist.test.ts` enforces that contract.
- Ingestion writes go through the dedup / checksum path so unchanged
  rows are skipped.

### Data layer

- Prisma is a singleton — only `src/lib/db/client.ts` may
  `new PrismaClient`.
- Multi-step writes that must succeed-or-fail-together run inside a
  `prisma.$transaction`.
- Saved-item joins use `upsert` on the composite unique key so
  duplicate saves are no-ops. Unsave operations only ever target the
  join table, never the catalog content.
- Journal / goal / milestone routes scope every read and write to the
  signed-in user (`requireUser` + `userId` check).

### Diagnostics

- New diagnostic checks build on `runDiagnostic()` and `startSection`
  / `finalizeSection` from `@/lib/diagnostics` so severity, timestamp,
  requestId, and duration are attached uniformly.
- Diagnostic results never embed sensitive values — only counts,
  labels, and short prefixes / lengths.
- New checks land with a matching test under `tests/diagnostics/`.

### Accessibility

- Every interactive element has an accessible name (icon-only buttons
  use `aria-label`).
- `<img>` tags inside named links use `alt=""`; standalone images
  use a meaningful `alt`.
- New form fields use `htmlFor` + `id` association.
- Click handlers on non-interactive elements pair with a keyboard
  equivalent (Escape on dialog backdrops; arrow-key navigation on
  combobox-style dropdowns).

### Tests

- Every new module ships with a matching test file under `tests/`.
- DB-touching tests run through `tests/helpers/prisma-mock.ts`; they
  must not require a live Postgres unless they live under
  `tests/integration/**`.
- Tests for security-critical surface (auth, rate limits, middleware,
  destructive confirms) are tracked by the Vitest coverage thresholds
  in `vitest.config.ts`.

## Naming / consistency

- Cookie names live with the matching helpers (`vf_session`,
  `vf_theme`, `vf_locale`, `vf_rite`) — every new cookie should follow
  the `vf_` prefix and live in its own helper module.
- Hardcoded site facts (canonical domain, sender email, app name)
  belong in `src/lib/config.ts` only.
- Do not introduce new environment variables for values that are
  already intentionally hardcoded in `appConfig`.
- Routes follow the existing folder shape: `src/app/<area>/page.tsx`
  for pages, `src/app/api/<area>/route.ts` for API endpoints.

## Things this repo deliberately does NOT do

- DNS management code. SPF / DKIM / DMARC live at the DNS provider
  and stay there.
- A second email provider or a second email sending path. All
  transactional email goes through `sendTransactionalEmail` from
  `@/lib/email/resend`.
- Wholesale design changes. Visual changes land only as small,
  targeted refinements to fix accessibility, responsive layout, or
  broken behaviour.
