# ACAPS Ground Truth

Minimal deployment prototype: Astro server-rendered pages on Vercel, Neon PostgreSQL, plain CSS, and native HTML forms. No frontend framework, client JavaScript, or email service is required.

## Local setup with an embedded test database

This is the quickest way to run the application locally. It uses PGlite (embedded PostgreSQL) and synthetic data; no Neon account, Docker, `.env` file, or database credentials are needed. Install Node.js 24 LTS and npm first.

From a terminal, run these commands in order. If you already have the repository, skip the clone and change into your existing checkout.

```sh
git clone https://github.com/LevOspennikov/ACAPS-ground-truth.git
cd ACAPS-ground-truth
node --version
npm ci
npm run dev:test
```

Leave that terminal running, then open **http://127.0.0.1:4322/admin**.

| Setting | Local test value |
| --- | --- |
| Admin password | **`local-test-admin`** |
| Database | PGlite, stored in `.test-data/pglite/` |
| Environment | Astro test mode (`--mode test`) |

The launcher applies the repository's SQL schemas and seeds twelve risks, eight anonymous experts with submitted answers, and **Local Test Expert**, assigned to the Afghanistan `R0353` questionnaire with no submitted answers. To try the expert flow:

1. Sign in with `local-test-admin`, open **Users**, and select **Local Test Expert**.
2. Select **Generate magic link**, then copy and open the displayed link locally. No email is sent.
3. Accept the invitation, answer questions, save progress, and reload to check that the server retained it.
4. Review and submit, then view group distributions. Return to admin to inspect completion and results.

Press **Ctrl+C** in the terminal to stop. To start again from the repository directory:

```sh
npm run dev:test
```

Test records persist across restarts. Sign in again after restarting: each launch creates a new admin signing secret. Stored expert sessions remain available until they expire or are revoked. Run only one embedded server against this data directory at a time.

To erase **only the local test database** and restore the original synthetic data, stop the test server with Ctrl+C first, then run these commands from the repository directory:

```sh
rm -rf .test-data
npm run dev:test
```

The launcher opts in with `TEST_DATABASE=embedded`, binds to loopback on port 4322, and disables Resend and AI question generation. Use the seeded questionnaire or add questions manually. Embedded mode takes precedence over any cloud database URL loaded from environment files, so this command never uses Neon. The application rejects it outside test mode, in production builds, and in Vercel environments. PGlite is a development dependency and is excluded from the production bundle. Normal `npm run dev` and deployments continue to use Neon; do not configure the test setting in deployed environments.

`.test-data/` is git-ignored. The embedded database exercises real SQL, authentication and server-side saves, but does not reproduce Neon's network behavior or production concurrency. `npm test` includes an isolated in-memory PGlite check for schema compatibility, repeatable seeding, transaction rollback and read-only queries; it does not access the persistent demo directory or a cloud database.

## Local setup with Neon

Use Node.js 22.23.4+ (Node 24 LTS recommended).

1. Run `npm install`.
2. Copy `.env.example` to `.env`.
3. Create a Neon project and paste its PostgreSQL connection string into `DATABASE_URL`. Use the connection string with SSL enabled.
4. Generate two independent secrets with `openssl rand -hex 32`. Set `ADMIN_PASSWORD` to one and `SESSION_SECRET` to the other (minimum 32 characters).
5. Run `npm run db:setup` to create the application tables and seed the twelve risk radar records. Alternatively, paste `db/schema.sql` into the Neon SQL Editor. Setup is idempotent and does not delete existing records.
6. Run `npm run dev`, then open `http://localhost:4321`.

The homepage works without environment variables as a deployment smoke check. The normal Neon-backed flow requires all three variables and the schema; the embedded test option above supplies a local database and credentials automatically.

## Optional AI question drafting

`GREEN_PT_API_KEY` enables server-side GreenPT drafting when an organiser selects **Generate questionnaire**. If the key is missing, or the provider times out, rejects the request, or returns unusable output, the app still creates the questionnaire and opens its editor with no questions. Use **Add a question** to write multiple-choice or free-text questions yourself. At least one question is required before invitations can be generated. Successful AI drafts open in the same editor for review.

This fallback also works in the embedded test environment, where AI calls are disabled. Select a country and risk, choose **Generate questionnaire**, then add and save your questions manually.

## Deploy to Vercel + Neon

1. Push this project to GitHub and import the repository into Vercel.
2. Select the **Astro** framework preset, repository root, build command `npm run build`, and the preset's default output setting. The Vercel adapter generates server functions automatically. Select Node.js 24.x in project settings.
3. Add `DATABASE_URL`, `ADMIN_PASSWORD`, and `SESSION_SECRET` as Vercel environment variables for each environment you use. Do not prefix these with `PUBLIC_`. Use a separate Neon database/branch for preview deployments if desired.
4. Apply `db/schema.sql` in that Neon database before testing the flow.
5. Deploy. Redeploy whenever environment variables change.

No Vercel CLI, Resend account, or separate backend host is needed for manual setup. `vercel.json` explicitly selects `npm run build` so the prototype database-reset hook runs when enabled. Frontend and backend code are separated within one deployment to keep this first setup small. Framework configuration follows the [Astro Vercel adapter documentation](https://docs.astro.build/en/guides/integrations-guide/vercel/).

## Optional standalone email helper

`src/server/email.js` exposes `sendEmail({ to, subject, text, html?, idempotencyKey? })` using native `fetch` and no SDK. It is server-only. Invitation generation uses it for active named profiles with an email address. Email configuration is optional for builds and normal app use; without it, admins can still generate and copy links. Automated tests mock all email sends.

1. Obtain a sending API key through the [Resend Vercel Marketplace integration](https://vercel.com/marketplace/resend), which sets `RESEND_API_KEY` in your selected project, or create a key in the [Resend dashboard](https://resend.com/api-keys).
2. Set `RESEND_API_KEY` and `EMAIL_FROM` in your local server environment (`.env` under Astro) or Vercel environment settings. Use `EMAIL_FROM="Ground Truth <onboarding@resend.dev>"` for testing. Keep both variables server-side, without a `PUBLIC_` prefix, and redeploy after changing Vercel variables.
3. The [Resend test domain restriction](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain) permits sending only to the email address associated with your Resend account. To reach arbitrary recipients, verify an owned domain and update `EMAIL_FROM` to an address on it. Check [Resend pricing](https://resend.com/pricing) for current free-tier quotas.

Example for server code, after configuring the environment (calling this sends an email):

```js
import { sendEmail } from './src/server/email.js';

const { id } = await sendEmail({
  to: 'your-resend-account@example.org', // Replace with your account address.
  subject: 'Ground Truth test',
  text: 'This is a standalone email helper test.',
  html: '<p>This is a standalone email helper test.</p>', // Optional.
  idempotencyKey: 'ground-truth-test-unique-operation-id', // Optional; persist per send.
});
// id confirms provider acceptance, not inbox delivery.
```

Each call accepts one bare email address, a nonempty subject and plain-text body, plus optional HTML. Quoted local parts and display-name recipients are not supported. Idempotency keys must be 1–256 visible ASCII characters without spaces. The helper reads configuration at call time, times out after 10 seconds (including reading the response), and never retries automatically.

Errors have sanitized messages and a stable `code`: `not_configured` for missing/unusable configuration, `invalid_input` for invalid arguments, `provider_rejected` for non-success HTTP responses, or `send_unconfirmed` for network failures, timeouts, or malformed success responses. An unconfirmed send may already have been accepted. For caller-initiated retries, reuse the same key and identical payload; [Resend retains idempotency keys for 24 hours](https://resend.com/docs/api-reference/emails/send-email). The helper never logs private data or attaches raw provider errors; callers must also avoid logging addresses, bodies or credentials.

## Reset on prototype deployments

Set `RESET_DATABASE_ON_DEPLOY=true` in Vercel's **Production** environment to start each production deployment with empty application tables recreated from `db/schema.sql`. This deletes application records, including categories, crises, region data, questionnaires, synthetic experts, assignments, invitations, sessions, answers, and manually added risk radar records. The risk radar catalog is then reseeded with the twelve CSV records. Admin credentials remain in Vercel environment variables. Integration-managed tables and the database itself are preserved.

While this mode is enabled, edit `db/schema.sql` and push to `main` to deploy the new schema. Existing data is intentionally discarded. The reset runs after `astro build` succeeds, in one database transaction; if recreating the schema fails, the drops roll back and the build fails. A later Vercel deployment failure can still leave the existing live app using the reset database. Avoid overlapping deployments while prototyping.

Local and Preview builds never trigger this reset. To stop deleting data, set `RESET_DATABASE_ON_DEPLOY=false` (or remove it) **before the next deployment**. Then use explicit, versioned migrations for changes to existing tables; normal setup does not alter existing tables.

## Test the prototype

1. Visit `/admin` and sign in with `ADMIN_PASSWORD`. Choose a country, then select a risk from its risk list.
2. Generate a questionnaire for the selected risk. Review and edit its questions, then choose eligible experts and create invitation links from the questionnaire page.
3. In **Users**, create and manage synthetic expert profiles and their country/risk coverage. Profiles need matching coverage to appear as eligible recipients.
4. Share an invitation link with the intended expert. Links are single-use and time-limited; existing answers and valid sessions are preserved when a new link is generated.
5. Answer a question, save, and reload. Next/Back/Save persist progress in Neon. A fresh invitation on another browser resumes that assignment, including its saved step. No offline storage or delivery is claimed.
6. Finish the questions, review, and submit. Submission is final. View results from the questionnaire page; submitted answers are shown without user identities, and draft contents stay private.
7. Deactivate a user to revoke all invitations/sessions and block access; reactivation requires a new link.
8. Confirm that users and links disappear on the next production deployment while prototype reset mode remains enabled.

Run `npm test` for validation, privacy-mode, embedded-database and reset-policy tests, and `npm run build` to validate Vercel output. Use `npm run dev:test` for the local end-to-end flow without cloud credentials, or configure Neon for the normal flow. Local builds preserve the database; opted-in production builds reset it.

## Country → risk → questionnaire workspace

The authenticated `/admin` page is organized by country. Every imported country becomes one region. Choose a country, select a risk from its dropdown, then view all current and sent questionnaires linked to that risk. Create a questionnaire from the selected risk; the server verifies that the risk belongs to that country. The existing question editor stays at its region/questionnaire URL and displays the linked risk.

The initial catalog retains all ten original CSV records and adds two Chad records: `R0233` and `R1043` (source data records 14 and 15). The seed now covers Afghanistan, Algeria, Bangladesh, Burundi and Chad, with 12 risks total. All 25 export fields remain intact. The original root CSV is unchanged and not required at runtime.

`risk_radar.region_slug` links risks to country regions, and `questionnaires.risk_id` links questionnaires to risks. `db/country-risk.sql` applies these additive schema changes and relaxes the old source-row limit. Existing risks get country links without overwriting their contents. Country questionnaires are linked to their selected risk at creation; there is no legacy questionnaire relinking flow.

Country boards batch their region, risk and questionnaire reads into one read-only Neon HTTP transaction. The country page includes contacts in that batch; the overview skips them and loads its country list concurrently when a country is explicitly selected. Opening the overview without a selection first loads the country list to choose its initial country.

Add risks from the selected country's expandable form. The server fixes the country from the stored region; changing a form field cannot move a risk into another country. Country contacts and reports remain accessible through the country page. `/admin/risk-radar` and `/radar` redirect to `/admin`; the old catalog POST endpoint is retired.

`npm run db:setup` creates the base schema, risk catalog and country-risk links, then imports the 12 records and their regions. Production builds do the same non-destructive initialization after the optional prototype reset. Preview builds never mutate the database automatically: use a separate preview database and initialize it explicitly. With reset mode enabled, production deployments erase manual entries and questionnaires and restore the 12 seeded risks and five countries.

## Expert countries, risks and invitations

Create/edit an expert in **Users** and select one or more countries. For each checked country, choose all-risk coverage or a nonempty set of that country's risks. Anonymous profiles use the same coverage settings without storing name or email. Existing users with no country show **Needs country assignment**. Existing region contacts are backfilled as all-risk members of their original country. Region contacts and Users share the same memberships.

Open a country/risk questionnaire, add questions, then select recipients under **Recipients and invitation links**. The picker includes active experts with matching coverage and existing recipients. **Generate invitation links** creates assignments and 48-hour single-use links atomically, then attempts an email for each active named profile with an email address. The user-detail **Generate magic link** action does the same. Anonymous profiles never trigger email. Raw links are shown in the authenticated admin response and sent to the intended named recipient, never stored in plaintext in the database. Copy links for recipients who need manual delivery.

Each recipient has a separate email result: provider acceptance (not confirmed inbox delivery), skipped email, rejection, unavailable configuration, or an uncertain outcome. Email failure preserves the generated link, assignment and answers. Share the displayed link manually after a failure; generating again replaces the previous unused link and attempts a new email. There are no automatic retries or background sends. The resend.dev test sender can only reach your Resend account address; other recipients will be rejected until you configure a verified sender domain.

Questions lock after the first invitation. Admins can later invite additional matching experts or regenerate links for previous recipients. Regeneration preserves assignments, drafts, submissions and valid sessions; older unused links are revoked. Changing country/risk coverage affects future assignments only: existing assignments and return links remain usable, even outside new coverage. Deactivation still blocks all access. Crisis-only questionnaires without country/risk retain the manual assignment path.

`db/expert-coverage.sql` creates `expert_countries` and `expert_risks` after the country-risk schema and backfills legacy contacts without replacing existing coverage. Setup and production initialization include it; prototype reset includes both new tables. Use a separate initialized database for local/preview checks. Production data is not changed by an unmerged feature branch.

## Expert group results

After final submission, `/questionnaire` shows thanks and server-aggregated distributions for choice questions, with pie charts, every answer option, counts and percentages. Other experts' written responses and individual response records are excluded. Each percentage uses the submitted answers to that question; drafts never contribute. Results are fetched on the server only when the page loads or the expert selects **Refresh results**. There is no automatic polling or client JavaScript for results.

Set the server-only `EXPERT_RESULTS_MIN_RESPONSES` environment variable to a nonnegative integer (default `0`). Withholding applies separately to each question. Below the threshold, no counts or percentages are sent to the browser. Zero shows available distributions immediately, including small groups; comparing live distributions can reveal a newly arriving answer. Invalid configuration withholds results and reports that configuration needs attention. Redeploy after changing the environment variable.

Viewing results requires an active expert session whose assignment has been submitted. The server derives the questionnaire from the session and renders only aggregate choice results. HTML responses use `Cache-Control: no-store`. Reopening an invitation in the same browser with a matching active session redirects to the questionnaire's saved or submitted state without consuming the invitation again or extending the session. Another browser, cleared cookies or an expired seven-day session requires a fresh invitation. Invitation acceptance remains single-use and requires an explicit POST.

## Optional Delphi reassessment

Questionnaires stay single-round until an organiser explicitly opens Round 2. Experts answer, save, submit, and see the original group results as before. No Round 2 link or reassessment access is available before that start.

To open reassessment:

1. From the country/risk overview or **All answers for this risk**, choose **Manage questionnaire**. This opens the existing questionnaire management page, with invitations first for sent questionnaires and question editing first for drafts. Its navigation links to **Invitations**, **Questions**, and **Results and rounds**. Open **Results and rounds** to manage the consultation rounds.
2. Collect at least one submitted response, then select **Start Round 2** when the panel is ready. This locks the questions and captures the submitted Round 1 choice distributions in one database statement. Repeated starts preserve the initial snapshot. The minimum expert-results threshold still applies separately to each question; starting with a small group may leave feedback withheld throughout reassessment.
3. Experts return through their existing invitation/session to `/questionnaire`. After their own Round 1 submission, this page now offers **Continue to Round 2** (or **View your Round 2 results** after submitting). No separate invitation or password is required. An expired session still requires a fresh link to the same assignment.
4. During reassessment, `/round-two` shows the original answer and frozen Round 1 feedback for the current choice question only. Text questions and the review screen show no group distributions. Original answers are preselected for convenience; changes are saved separately. Refreshing results stays on the current Round 2 step.
5. After submitting Round 2, experts see all questions on one scrollable results page. Each compact card shows their answer change and a shared table of Round 1/2 percentages, response counts and percentage-point changes, with small bars for comparison. Timestamps and explanations appear once above the cards. A single **Refresh all results** link reloads the whole page and updates every revised distribution; there are no individual question refresh controls. Only submitted Round 2 answers contribute, the expert-results minimum threshold applies per question, and drafts or other experts' written responses are never exposed. An expert who has not submitted Round 2 cannot access its live group results.
6. The admin results page tracks Round 2 submitted/in-progress/not-started counts among Round 1 submitters and compares experts who submitted both rounds. Comparisons are withheld below five valid pairs per question. Movement counts exclude “Cannot assess” pairs and show their own denominator. Answer changes describe revisions, not a measure of convergence.

Pending experts can still complete Round 1 after reassessment starts and then join Round 2. Their late answers do not alter the frozen feedback. Admin Round 1 reports continue to include all submitted answers; the paired comparison uses only completed pairs. There is currently no automatic email on round opening, closing/reopening control, or additional round beyond Round 2.

The additive migration at the end of `db/schema.sql` adds `questionnaires.round_two_started_at` and `round_one_feedback`; existing answers, assignments, invitations and sessions are preserved. Production initialization applies it automatically; for local Neon or preview databases run the normal `npm run db:setup` with that database's `.env`, or apply `db/schema.sql` explicitly. `npm run dev:test` applies it on startup. If an existing questionnaire already has Round 2 drafts/submissions from the earlier prototype, migration keeps it open and captures current feedback once at migration time; historical feedback was not stored and cannot be reconstructed. A fresh database/demo remains single-round until you select **Start Round 2**.

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

This is a synthetic-data deployment prototype organized around country risks and their questionnaires. User profiles support named (admin-only identity) and anonymous modes; deactivation preserves answers while blocking access. There are no user deletions. Questionnaire metadata is set at creation, and single-choice/text prompts stay defined in code. Each questionnaire stores an immutable prompt snapshot. Responses contain question-ID-keyed answers and server-side progress, not the old fixed rating columns. Admin results show single-choice counts over all submissions and the latest 100 unattributed responses. Free text may contain identifying information and must be treated as confidential. Experts see aggregate choice distributions only after submitting, subject to the configured withholding threshold. There are no public attribution options.

The Neon Vercel integration may provide `STORAGE_DATABASE_URL`; the app and schema setup script accept this as a fallback to `DATABASE_URL`. Keep `ADMIN_PASSWORD` and `SESSION_SECRET` configured separately. If the database is new, sign in to admin and use **Initialize missing tables**, or apply `db/schema.sql` through Neon's SQL Editor. Initialization uses only `CREATE TABLE IF NOT EXISTS` and preserves existing records. Production secrets marked Sensitive cannot be downloaded with `vercel env pull`; configure a separate local development database connection instead.

Admin access uses one environment password and a signed eight-hour cookie. Expert links contain opaque random tokens, expire after 48 hours, and are redeemed once in an atomic database statement; only token hashes are stored in Neon. Redemption requires an explicit POST so automated link previews do not consume invitations. Expert sessions are scoped to one assignment, expire after seven days, and use HTTP-only, secure cookies on deployed builds. Mutations enforce same-origin requests and server authorization. Submitted answers are locked against concurrent edits. Token-bearing URLs should be excluded from any future analytics or request logging; the app sends strict-origin and no-store headers. The referrer policy strips paths and query strings while preserving the Origin header required by native form submissions; do not replace it with no-referrer, which makes browser form POSTs send Origin: null.

Before handling real experts, add proper organiser accounts and login rate limiting, delivery tracking and queued email retries, expert-controlled privacy preferences, panels, configurable question editing, pagination for large admin lists, and aggregate suppression rules. Forms require connectivity and explicitly report server saves; there is no offline queue.

The supplied root-level `risk-radar-export.csv` now provides the twelve-record risk catalog seed. Expert and questionnaire demonstrations still use synthetic personal details. `CLAUDE.md` and `docs/challenge-brief.md` were not present. No existing challenge data was modified.
