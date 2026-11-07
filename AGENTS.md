# AGENTS.md — ACAPS Ground Truth

## Goal
Build a lightweight, mobile-friendly platform where trusted humanitarian experts validate ACAPS risk analyses through short questionnaires. Prioritise privacy, meaningful contributions, and low effort (a few minutes per response).

## Project documentation
- [README.md](README.md): organiser-facing product overview.
- [README-TECH.md](README-TECH.md): local setup, environment variables, deployment, database setup, and operational behaviour. Read the relevant sections before changing these areas and keep them aligned with the implementation.
- [Challenge brief](https://github.com/Hackathon-for-Good-The-Hague/HFG8-ACAPS-Ground-Truth/blob/main/docs/challenge-brief.md) and [evaluation criteria](https://github.com/Hackathon-for-Good-The-Hague/HFG8-ACAPS-Ground-Truth/blob/main/docs/evaluation-criteria.md): upstream requirements. The challenge's `CLAUDE.md` and `docs/challenge-brief.md` are not present locally.

## Stack
- **JavaScript** (not TypeScript), **Astro** with server-rendered pages and minimal vanilla JavaScript; use plain CSS and native HTML forms by default.
- Deploy on **Vercel** with the Astro Vercel adapter and server endpoints; use **Neon PostgreSQL** for persistent data and **Resend** for invitation emails.
- **GreenPT** drafts risk-based questions for organiser review. Keep model calls server-side. Resend is optional; manually shared invitation links also work.
- Keep secrets in environment variables; never commit credentials or expert data.

## Current product flow
**Organiser/admin:** Sign in, select a country and risk, generate and review a questionnaire, edit single-choice or free-text questions, select experts with matching country/risk coverage, and generate invitation links. Questions lock after the first invitation. Review completion counts, submitted context, and answer distributions.

**Expert:** Open an emailed or manually shared invitation, explicitly accept it, answer one question at a time, save progress on the server, review, and submit. Submission is final. A valid session resumes the assigned questionnaire and permits aggregate choice results only after submission.

Profiles currently support admin-managed named and anonymous modes. Country/risk coverage determines eligibility for new assignments. Expert-controlled privacy preferences, dedicated panels, iterative consultation rounds, and forecast scoring remain development goals; distinguish them from existing behaviour.

## Data model
- Main entities: `experts`, `regions`, `risk_radar`, `expert_countries`, `expert_risks`, `questionnaires`, `assignments`, `invitations`, `expert_sessions`, and `responses`.
- Questionnaires link to countries and risks and store question snapshots as JSON. Responses store question-ID-keyed answers and progress. Plan migrations when changing existing storage.
- The catalog seed contains 12 risks across five countries, including Chad R1043. Runtime seed records live in `db/seeds/`; the synthetic questionnaire/response demo in `src/data/demo.js` currently targets Afghanistan R0353.
- Preserve source exports and existing challenge material. Use synthetic expert profiles and responses for the hackathon.

## Privacy and security
- Never attribute individual contributions publicly. Anonymous profiles must not store names or email addresses. Treat free text as confidential because it may contain identifying details.
- Enforce admin/expert access and per-record authorization on every server request. Expert-facing results must exclude identities, individual response records, draft answers, and other experts' free text. Some admin views associate responses with pseudonyms; do not claim all admin results are unlinkable.
- Magic links use opaque tokens stored only as hashes, expire after 48 hours, and require single-use POST redemption. Expert sessions are scoped to one assignment and expire after seven days. Preserve these protections and exclude tokens and personal data from logs.
- Mutations require same-origin checks. Preserve secure, HTTP-only cookies, HTML `no-store` headers, and the `strict-origin` referrer policy required by native form submissions.
- Apply `EXPERT_RESULTS_MIN_RESPONSES` per question before sending aggregate counts to experts. Its current default is `0`; small-group disclosure and changes between refreshes need explicit consideration. Keep country/context groups small (roughly 5–10 experts).
- Expert-selectable identity settings remain a challenge goal. Preserve existing protections when extending the privacy model.

## Implementation principles
- Preserve the complete flow: organiser prepares a questionnaire, invites experts, experts respond, and the organiser reviews progress and results.
- Expert pages must be server-rendered and usable with JavaScript disabled; use progressive enhancement only where valuable.
- Optimize for slow/intermittent mobile internet: minimal assets, no heavy frontend libraries, small page payloads, and short forms.
- Preserve server-side partial saves and saved-step recovery. The current flow requires connectivity. If adding local drafts, clearly distinguish "saved on device" from "saved on server"; never claim offline submissions were delivered.
- Keep pages accessible, mobile-first, and clear about completion states.
- Validate inputs and permissions on the server. Keep components small, code readable, and avoid unnecessary dependencies.

## Development and verification
- Keep database/authentication/validation services in `src/server/`, pages and form endpoints in `src/pages/`, and schema/setup changes in `db/` and `scripts/`.
- Use `npm run dev` for local development, `npm test` for automated checks, and `npm run build` for Vercel output validation. Use the Node version documented in [README-TECH.md](README-TECH.md).
- Database-backed end-to-end verification requires a separately configured Neon database. Email tests should mock delivery; avoid sending invitations as a side effect of tests.
- Read the deployment/reset instructions before changing schema or build scripts. With `RESET_DATABASE_ON_DEPLOY=true`, production builds intentionally erase application data. Local and preview builds must never trigger this reset or automatic production seeding.
- Preserve saved answers, submitted-response locks, and valid sessions when regenerating invitation links. Deactivation must block expert access.
