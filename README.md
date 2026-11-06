# ACAPS Ground Truth

Minimal deployment prototype: Astro server-rendered pages on Vercel, Neon PostgreSQL, plain CSS, and native HTML forms. No frontend framework, client JavaScript, or email service is required.

## Local setup

Use Node.js 22.23.4+ (Node 24 LTS recommended).

1. Run `npm install`.
2. Copy `.env.example` to `.env`.
3. Create a Neon project and paste its PostgreSQL connection string into `DATABASE_URL`. Use the connection string with SSL enabled.
4. Generate two independent secrets with `openssl rand -hex 32`. Set `ADMIN_PASSWORD` to one and `SESSION_SECRET` to the other (minimum 32 characters).
5. Run `npm run db:setup` to create the empty database tables. Alternatively, paste `db/schema.sql` into the Neon SQL Editor. Setup is idempotent and does not delete existing records.
6. Run `npm run dev`, then open `http://localhost:4321`.

The homepage works without environment variables as a deployment smoke check. Database-backed functionality requires all three variables and the schema.

## Deploy to Vercel + Neon

1. Push this project to GitHub and import the repository into Vercel.
2. Select the **Astro** framework preset, repository root, build command `npm run build`, and the preset's default output setting. The Vercel adapter generates server functions automatically. Select Node.js 24.x in project settings.
3. Add `DATABASE_URL`, `ADMIN_PASSWORD`, and `SESSION_SECRET` as Vercel environment variables for each environment you use. Do not prefix these with `PUBLIC_`. Use a separate Neon database/branch for preview deployments if desired.
4. Apply `db/schema.sql` in that Neon database before testing the flow.
5. Deploy. Redeploy whenever environment variables change.

No Vercel CLI, `vercel.json`, Resend account, or separate backend host is needed. Frontend and backend code are separated within one deployment to keep this first setup small. Framework configuration follows the [Astro Vercel adapter documentation](https://docs.astro.build/en/guides/integrations-guide/vercel/).

## Test the prototype

1. Visit `/admin` and sign in with `ADMIN_PASSWORD`.
2. Create a questionnaire with the prefilled synthetic scenario. This also creates one synthetic expert assignment.
3. Copy the generated invitation into a private browser window (or another browser). Accept it to establish an expert session. Do not share real personal information.
4. Choose one rating, save progress, and reload: the answer comes from Neon.
5. Complete both ratings and submit. Submitted responses cannot be changed. Reload `/admin` to see completion and average ratings.
6. Generate additional invitations to test multiple synthetic experts. Each button click creates a new participant, rather than resending an existing assignment.
7. Verify that reusing an accepted invitation fails, while `/questionnaire` still works in the original expert browser for seven days.

Run `npm test` for form-validation and origin checks, and `npm run build` to validate Vercel build output. A live Neon database is required for the end-to-end flow above; the build does not connect to the database.

## Structure

```text
db/schema.sql                 Idempotent PostgreSQL schema
scripts/setup-db.js           Explicit schema setup; never runs on page requests
src/layouts/                  Shared server-rendered shell
src/styles/                   Plain mobile-friendly CSS
src/pages/index.astro         Public landing / deployment check
src/pages/admin/              Admin UI
src/pages/questionnaire/      Expert UI
src/pages/invite.astro        Invitation acceptance confirmation
src/pages/api/admin/          Admin form endpoints
src/pages/api/expert/         Expert form endpoints
src/server/                   Database access, authentication, validation, services
src/middleware.js             Privacy and security headers
```

## Current scope and next iterations

This is a synthetic-data deployment prototype. Three fixed prompts (likelihood, confidence, optional context) keep the first flow small. Questionnaire metadata is editable at creation only. Ratings use a 1–5 ordinal scale, not percentages. Admin aggregates have no individual attribution. There are no expert-facing group results.

Admin access uses one environment password and a signed eight-hour cookie. Expert links contain opaque random tokens, expire after 48 hours, and are redeemed once in an atomic database statement; only token hashes are stored in Neon. Redemption requires an explicit POST so automated link previews do not consume invitations. Expert sessions are scoped to one assignment, expire after seven days, and use HTTP-only, secure cookies on deployed builds. Mutations enforce same-origin requests and server authorization. Submitted answers are locked against concurrent edits. Token-bearing URLs should be excluded from any future analytics or request logging; the app sends no-referrer and no-store headers.

Before handling real experts, add proper organiser accounts and login rate limiting, session revocation/recovery, invitation resend for existing assignments, expert privacy preferences, panels, configurable question types, and aggregate suppression rules. Forms require connectivity and explicitly report server saves; there is no offline queue.

The repository did not contain `data/risk-radar-export.csv`, `CLAUDE.md`, or `docs/challenge-brief.md` at implementation time. The demo uses a clearly labelled synthetic scenario and synthetic participant identifiers; it does not claim to import ACAPS risk data. No existing challenge files were replaced.
