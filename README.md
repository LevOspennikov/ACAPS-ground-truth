# ACAPS Ground Truth

**A few minutes of expert insight to help build a clearer picture of humanitarian risk.**

ACAPS Ground Truth gives organisers a structured way to consult trusted experts about existing risk analyses. It connects each questionnaire to a country and an ACAPS risk, helping analysts gather independent judgements, spot disagreement and identify missing context.

Built for Hackathon for Good #8, the project brings the full consultation workflow into one lightweight web application.

## How it works

1. **Prepare a consultation.** Choose a country and risk from the ACAPS Risk Radar catalog. Generate a questionnaire with AI assistance, then review and edit the questions before inviting experts.
2. **Invite relevant experts.** Manage profiles and country/risk coverage, select recipients, and generate private invitation links. Invitations support email delivery through Resend or manual sharing.
3. **Contribute at a convenient pace.** Experts open their link without a password, answer one question at a time, save progress on the server and return later. They review their answers before final submission and can add written context through “What did we miss?”
4. **Review the group’s perspective.** Organisers see completion counts, answer distributions and submitted context. After submitting, experts can view aggregate choice results, giving them feedback while keeping their initial contribution independent.

## Designed around experts

The mobile-friendly interface uses short, focused forms and works with JavaScript disabled. The questionnaire page is especially lightweight, with a final page size of just **3.5 KB**, helping keep contributions accessible on slow connections. Server-saved progress supports returning to an unfinished response. AI assists the organiser with question drafting, while experts interact with a straightforward questionnaire.

The application supports named profiles, whose names and email addresses are visible only to administrators, and anonymous profiles that store neither. Private invitation links expire after 48 hours and can be redeemed once to establish an assignment-specific session. Expert-facing group results contain aggregate choice answers, with a configurable minimum-response threshold for each question.

## A practical foundation

The application uses **JavaScript and Astro** for server-rendered pages, native HTML forms and plain CSS. **Neon PostgreSQL** stores risks, questionnaires, assignments and responses. **Vercel** hosts the application and server endpoints, with **Resend** handling configured invitation emails and **GreenPT** assisting with questionnaire drafting.

Server-side checks validate submissions and access permissions. Invitation tokens are stored as hashes, and submitted responses are locked against further edits. Questions also lock once invitations begin, preserving a consistent questionnaire for recipients.

The demonstration uses synthetic expert profiles and responses alongside **12 ACAPS risk records across five countries**, including the Chad/Sudan scenario **R1043**. The repository includes automated checks for answer validation, privacy-related behaviour, result aggregation and invitation email handling.

## Explore the project

Start at `/admin` to explore the organiser workspace, then follow a generated invitation to experience the expert journey. See [README-TECH.md](README-TECH.md) for local setup, environment variables and deployment instructions.
