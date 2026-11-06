# ACAPS Ground Truth

Minimal deployment prototype: Astro server-rendered pages on Vercel, Neon PostgreSQL, plain CSS, and native HTML forms. No frontend framework, client JavaScript, or email service is required.

## Local setup

Use Node.js 22.23.4+ (Node 24 LTS recommended).

1. Run `npm install`.
2. Copy `.env.example` to `.env`.
3. Create a Neon project and paste its PostgreSQL connection string into `DATABASE_URL`. Use the connection string with SSL enabled.
4. Generate two independent secrets with `openssl rand -hex 32`. Set `ADMIN_PASSWORD` to one and `SESSION_SECRET` to the other (minimum 32 characters).
5. Run `npm run db:setup` to create the application tables and seed the twelve risk radar records. Alternatively, paste `db/schema.sql` into the Neon SQL Editor. Setup is idempotent and does not delete existing records.
6. Run `npm run dev`, then open `http://localhost:4321`.

The homepage works without environment variables as a deployment smoke check. Database-backed functionality requires all three variables and the schema.

## Deploy to Vercel + Neon

1. Push this project to GitHub and import the repository into Vercel.
2. Select the **Astro** framework preset, repository root, build command `npm run build`, and the preset's default output setting. The Vercel adapter generates server functions automatically. Select Node.js 24.x in project settings.
3. Add `DATABASE_URL`, `ADMIN_PASSWORD`, and `SESSION_SECRET` as Vercel environment variables for each environment you use. Do not prefix these with `PUBLIC_`. Use a separate Neon database/branch for preview deployments if desired.
4. Apply `db/schema.sql` in that Neon database before testing the flow.
5. Deploy. Redeploy whenever environment variables change.

No Vercel CLI, Resend account, or separate backend host is needed for manual setup. `vercel.json` explicitly selects `npm run build` so the prototype database-reset hook runs when enabled. Frontend and backend code are separated within one deployment to keep this first setup small. Framework configuration follows the [Astro Vercel adapter documentation](https://docs.astro.build/en/guides/integrations-guide/vercel/).

## Reset on prototype deployments

Set `RESET_DATABASE_ON_DEPLOY=true` in Vercel's **Production** environment to start each production deployment with empty application tables recreated from `db/schema.sql`. This deletes application records, including categories, crises, region data, questionnaires, synthetic experts, assignments, invitations, sessions, answers, and manually added risk radar records. The risk radar catalog is then reseeded with the twelve CSV records. Admin credentials remain in Vercel environment variables. Integration-managed tables and the database itself are preserved.

While this mode is enabled, edit `db/schema.sql` and push to `main` to deploy the new schema. Existing data is intentionally discarded. The reset runs after `astro build` succeeds, in one database transaction; if recreating the schema fails, the drops roll back and the build fails. A later Vercel deployment failure can still leave the existing live app using the reset database. Avoid overlapping deployments while prototyping.

Local and Preview builds never trigger this reset. To stop deleting data, set `RESET_DATABASE_ON_DEPLOY=false` (or remove it) **before the next deployment**. Then use explicit, versioned migrations for changes to existing tables; normal setup does not alter existing tables.

## Test the prototype

1. Visit `/admin` and sign in with `ADMIN_PASSWORD`. The overview links to **Users** and **Crises & categories**.
2. In Crises, create a category, then a crisis with title, country and description. Categories can be renamed or archived and crises filtered by category/status.
3. Open the crisis and create a questionnaire. Its questions are snapshotted from `src/data/questions.js`; these crisis questionnaires use the code template. Region questionnaires retain their existing question editor. Changing the code template never changes an existing questionnaire.
4. In Users, create a named or anonymous synthetic profile. Every user has a pseudonym. Anonymous profiles must have empty name/email; the database enforces this. Converting a named profile requires clearing those fields and explicitly confirming removal.
5. Open the user, assign the questionnaire, then generate a magic link. Copy it to another browser and accept it. Regenerating a link reuses the same assignment and invalidates older unused invitations without deleting answers or valid sessions.
6. Answer a question, save, and reload. Next/Back/Save all persist progress in Neon. A fresh invitation on another browser resumes that assignment, including its saved step. No offline storage or delivery is claimed.
7. Finish the questions, review, and submit. Submission is final. Open results through the crisis to see single-choice counts and confidential submitted answers without user identities. Draft contents stay private.
8. Deactivate a user to revoke all invitations/sessions and block access; reactivation requires a new link. Archive a crisis to stop new questionnaires/assignments while keeping existing expert access. Archiving a category removes it from new-crisis choices, without changing existing crises.
9. Confirm that all users and links disappear on the next production deployment while prototype reset mode remains enabled.

Run `npm test` for validation, privacy-mode and reset-policy tests, and `npm run build` to validate Vercel output. A live Neon database is required for the end-to-end flow. Local builds preserve the database; opted-in production builds reset it.

## Country → risk → questionnaire workspace

The authenticated `/admin` page is organized by country. Every imported country becomes one region. Choose a country, select a risk from its dropdown, then view all current and sent questionnaires linked to that risk. Create a questionnaire from the selected risk; the server verifies that the risk belongs to that country. The existing question editor stays at its region/questionnaire URL and displays the linked risk.

The initial catalog retains all ten original CSV records and adds two Chad records: `R0233` and `R1043` (source data records 14 and 15). The seed now covers Afghanistan, Algeria, Bangladesh, Burundi and Chad, with 12 risks total. All 25 export fields remain intact. The original root CSV is unchanged and not required at runtime.

`risk_radar.region_slug` links risks to country regions, and `questionnaires.risk_id` links questionnaires to risks. `db/country-risk.sql` applies these additive schema changes and relaxes the old source-row limit. Existing risks get country links without overwriting their contents. Country questionnaires are linked to their selected risk at creation; there is no legacy questionnaire relinking flow.

Country boards batch their region, risk and questionnaire reads into one read-only Neon HTTP transaction. The country page includes contacts in that batch; the overview skips them and loads its country list concurrently when a country is explicitly selected. Opening the overview without a selection first loads the country list to choose its initial country.

Add risks from the selected country's expandable form. The server fixes the country from the stored region; changing a form field cannot move a risk into another country. Country contacts and reports remain accessible through the country page. `/admin/risk-radar` and `/radar` redirect to `/admin`; the old catalog POST endpoint is retired.

`npm run db:setup` creates the base schema, risk catalog and country-risk links, then imports the 12 records and their regions. Production builds do the same non-destructive initialization after the optional prototype reset. Preview builds never mutate the database automatically: use a separate preview database and initialize it explicitly. With reset mode enabled, production deployments erase manual entries and questionnaires and restore the 12 seeded risks and five countries.

## Expert countries, risks and invitations

Create/edit an expert in **Users** and select one or more countries. For each checked country, choose all-risk coverage or a nonempty set of that country's risks. Anonymous profiles use the same coverage settings without storing name or email. Existing users with no country show **Needs country assignment**. Existing region contacts are backfilled as all-risk members of their original country. Region contacts and Users share the same memberships.

Open a country/risk questionnaire, add questions, then select recipients under **Recipients and invitation links**. The picker includes active experts with matching coverage and existing recipients. **Generate invitation links** creates assignments and 48-hour single-use links atomically; copy each link to its intended expert. Raw links are shown only in the authenticated POST response, never stored in plaintext. No email is sent automatically.

Questions lock after the first invitation. Admins can later invite additional matching experts or regenerate links for previous recipients. Regeneration preserves assignments, drafts, submissions and valid sessions; older unused links are revoked. Changing country/risk coverage affects future assignments only: existing assignments and return links remain usable, even outside new coverage. Deactivation still blocks all access. Crisis-only questionnaires without country/risk retain the manual assignment path.

`db/expert-coverage.sql` creates `expert_countries` and `expert_risks` after the country-risk schema and backfills legacy contacts without replacing existing coverage. Setup and production initialization include it; prototype reset includes both new tables. Use a separate initialized database for local/preview checks. Production data is not changed by an unmerged feature branch.

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

This is a synthetic-data deployment prototype with user, crisis and category management. Categories apply only to crises. User profiles support named (admin-only identity) and anonymous modes; deactivation preserves answers while blocking access. There are no user deletions. Questionnaire metadata is set at creation, and single-choice/text prompts stay defined in code. Each questionnaire stores an immutable prompt snapshot. Responses contain question-ID-keyed answers and server-side progress, not the old fixed rating columns. Results show single-choice counts over all submissions and the latest 100 unattributed responses. Free text may contain identifying information and must be treated as confidential. There are no expert-facing group results or public attribution options.

The Neon Vercel integration may provide `STORAGE_DATABASE_URL`; the app and schema setup script accept this as a fallback to `DATABASE_URL`. Keep `ADMIN_PASSWORD` and `SESSION_SECRET` configured separately. If the database is new, sign in to admin and use **Initialize missing tables**, or apply `db/schema.sql` through Neon's SQL Editor. Initialization uses only `CREATE TABLE IF NOT EXISTS` and preserves existing records. Production secrets marked Sensitive cannot be downloaded with `vercel env pull`; configure a separate local development database connection instead.

Admin access uses one environment password and a signed eight-hour cookie. Expert links contain opaque random tokens, expire after 48 hours, and are redeemed once in an atomic database statement; only token hashes are stored in Neon. Redemption requires an explicit POST so automated link previews do not consume invitations. Expert sessions are scoped to one assignment, expire after seven days, and use HTTP-only, secure cookies on deployed builds. Mutations enforce same-origin requests and server authorization. Submitted answers are locked against concurrent edits. Token-bearing URLs should be excluded from any future analytics or request logging; the app sends strict-origin and no-store headers. The referrer policy strips paths and query strings while preserving the Origin header required by native form submissions; do not replace it with no-referrer, which makes browser form POSTs send Origin: null.

Before handling real experts, add proper organiser accounts and login rate limiting, email delivery, expert-controlled privacy preferences, panels, configurable question editing, pagination for large admin lists, and aggregate suppression rules. Forms require connectivity and explicitly report server saves; there is no offline queue.

The supplied root-level `risk-radar-export.csv` now provides the twelve-record risk catalog seed. Expert and questionnaire demonstrations still use synthetic personal details. `CLAUDE.md` and `docs/challenge-brief.md` were not present. No existing challenge data was modified.
