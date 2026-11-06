# AGENTS.md — ACAPS Ground Truth

## Goal
Build a lightweight, mobile-friendly platform where trusted humanitarian experts validate ACAPS risk analyses through short questionnaires. Prioritise anonymity, meaningful contributions, and low effort (a few minutes per response).

## Stack
- **JavaScript** (not TypeScript), **Astro** with server-rendered pages and minimal vanilla JavaScript; use plain CSS and native HTML forms by default.
- Deploy on **Vercel** with the Astro Vercel adapter and server endpoints; use **Neon PostgreSQL** for persistent data and **Resend** for invitation emails.
- Keep secrets in environment variables; never commit credentials or expert data.

## Roles and flows
**Expert:** Receive a time-limited, single-use magic link by email that establishes a secure session for returning later; open an assigned questionnaire without a password; answer questions, save progress, optionally add evidence/context, submit, and see unanswered questions or outstanding requests. Show an anonymised group summary only when appropriate, after independent submission.

**Organiser/admin:** Sign in securely; create and edit questions/questionnaires (multiple choice, rating/probability, free text); assign questionnaires to experts or country panels; send/resend invitations; track invitation and completion status; view aggregate answers, agreement/disagreement, missing information, and basic statistics; manage experts and their panel memberships.

## Data model
Use entities such as `experts`, `panels`, `questionnaires`, `questions`, `assignments`, `invitations`, `responses`, and `answers`. Link questionnaires to ACAPS risk IDs/countries when relevant. Seed the demo with synthetic experts and the repository's `data/risk-radar-export.csv`.

## Privacy and security
- Respect expert-selectable identity settings: known to ACAPS, pseudonymous to peers, or fully anonymous; never attribute individual contributions publicly.
- Enforce role-based access and per-record authorization on every server request; avoid exposing identities in aggregates, exports, or logs.
- Magic links must expire, be single-use, and be scoped to the intended expert/assignment; do not place sensitive information in link URLs.
- Use synthetic personal data for the hackathon; keep small country/context panels (roughly 5–10 experts).

## Implementation principles
- Start with the complete MVP flow: admin creates questionnaire → invites expert → expert responds → admin sees progress and aggregated results.
- Expert pages must be server-rendered and usable with JavaScript disabled; use progressive enhancement only where valuable.
- Optimize for slow/intermittent mobile internet: minimal assets, no heavy frontend libraries, small page payloads, and short forms.
- Support server-side partial saves; optionally persist unsent drafts locally and clearly distinguish "saved on device" from "saved on server". Never claim offline submissions were delivered.
- Keep pages accessible, mobile-first, and clear about completion states.
- Validate inputs and permissions on the server. Keep components small, code readable, and avoid unnecessary dependencies.
- Follow the challenge constraints in `README.md`, `CLAUDE.md`, and `docs/challenge-brief.md`. Do not overwrite existing challenge data or documentation.
