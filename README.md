# Push Hub

Expert role: Senior Product Manager & Mobile Health App Architect (mobile-first, social fitness)

Task:

- Produce a full, production-ready specification, UX flow set, technical architecture, and implementation roadmap for a mobile app inspired by The Pushup Challenge (app: https://www.thepushupchallenge.com.au/resources/the-app and Apple Store listing). The user wants a dedicated mobile app that they can share with friends to get daily push-up targets; they must be able to control both the amount (count) and frequency (how often) of targets.

- Before delivering the full spec, provide a prioritized list of suggested improvements, feature trade-offs, and safety/risk concerns (challenge/improve mode). Then produce the detailed deliverables.

Context (use all as factual context):

- Source inspiration: The Pushup Challenge app. Key features visible from the provided screenshots: orange-branded UI, circular daily-progress meter, numeric daily target and "Bank push-ups" button, achievement badges popups, team trophies and team stats UI, community/national leaderboards, a screen with a "Mental Health Fact" (educational content), and bottom tab navigation (home, stats/achievements, profile/other). Data appears refreshed frequently (team trophy data every 5 minutes). The app supports team collaboration, and social leaderboards. Visual style uses high-contrast orange and dark headers.

- User goals for this new app: share with friends, get daily push-up targets, control amount and frequency of targets.

- Platforms: mobile phones (iOS and Android). Target audience: general adult users seeking daily exercise and social motivation; may include teams and community features.

Instructions (what I want you to produce):

1) Improvements & trade-offs (brief, prioritized):

   - Suggest 6–10 design/product improvements or alternative features (engagement, retention, accessibility, safety, privacy, monetization, fraud prevention). For each, give the trade-offs (engineering cost, privacy/regulatory risk, time-to-market).

2) Safety & medical disclaimers & gating: short, recommended language and implementation points for exercise safety, age gating, medical/health disclaimers, and when to recommend professional consultation. Include logic for limiting daily targets by self-reported fitness/medical flags.

3) Product spec & core feature list: must-haves (MVP), nice-to-haves (phase 2), optional (phase 3). For each feature include user stories, acceptance criteria, and success metrics (KPIs).

   - Ensure MVP covers: account & authentication (email/Social SSO), friends & teams, set and share daily targets, adjustable amount & frequency, push notifications/reminders, bank push-ups (pre-log/unbanking), achievements/badges, progress meter UI, leaderboards (team/community/national), mental-health educational content screen, and basic analytics.

4) UX flows & UI spec: produce screen-by-screen flows (Home/Daily target, Bank push-ups, Log push-ups, Achievements, Team page, Community/Leaderboards, Profile/Settings) and describe primary components on each screen (labels, components, behaviors, accessibility labels). Include suggested color tokens, typography scale, and icon set guidance that matches the orange-themed branding.

   - Provide wireframe annotations suitable for direct hand-off to a designer or Figma engineer (component names and props). Provide example microcopy for key buttons, badges, and onboarding.

5) Targeting algorithm & scheduling: define an algorithm for generating daily push-up targets per user and per team, including:

   - How the app computes a target (baseline assessment, adaptive progression, manual override, team averaging), minimum/maximum caps, frequency control (daily vs multiple times/day), and "banking" logic (rollover push-ups vs bank limit). Provide pseudocode or clear formulas.

6) Gamification & social mechanics: badge list, trophy progression, milestone triggers, teammate contribution rules, anti-cheat suggestions (sanity checks), and share-to-friend flows.

7) Data model & API design: provide a concise data schema (users, teams, sessions, pushups_log, badges, leaderboards) and example CRUD REST endpoints or GraphQL schema for core flows. Include sample JSON payloads for creating a session, banking push-ups, logging push-ups, and updating targets.

8) Integrations & tech notes: recommend integration points (Apple HealthKit, Google Fit, push notifications, social sharing, payment/donation gateways), and platform & framework recommendations (native vs React Native / Flutter), plus offline-first considerations and data sync design.

9) Security, privacy & legal checklist: detail how to handle personally identifiable information, opt-in for data sharing, retention policy, GDPR/CCPA considerations. Include suggested encryption, authentication and rate-limiting controls.

10) Analytics & A/B test plan: list key events to track (e.g., daily target set, pushups_logged, bank_pushups, invite_sent, donation_made), suggested funnels, and 3 A/B experiments to improve adherence.

11) Roadmap & effort estimate: provide a 3-phase roadmap (MVP, Phase 2, Phase 3) with suggested timeline and team composition (roles + rough story-point or person-month estimates), and a recommended minimal tech stack for each phase.

12) QA & testing checklist: accessibility checks, workout-safety checks, instrumentation and performance targets.

Constraints (strict):

- Output must be practical for a cross-platform mobile app (iOS + Android). If you suggest HealthKit/GoogleFit integration, provide alternative manual logging flows for users who don't grant permissions.

- Respect privacy/legal constraints for healthcare: include mandatory in-app disclaimer that this is not medical advice and implement soft gating for high-intensity targets (age/medical conditions). Do not claim the app diagnoses or treats medical issues.

- Do not require specialized hardware (no mandatory heart-rate or motion form detection), but where added sensors could help, list them as optional enhancements.

- Time-to-market: MVP should be implementable by a small cross-functional team within 3 months (give sprint-by-sprint plan for that). Provide lean estimates (minimal viable backend features).

- Accessibility: color contrast and large targets; provide alt text and voice-over labels for key screens.

Output format (how I want it returned):

- Start with the prioritized improvements & trade-offs list.

- Then the safety & legal disclaimers & gating.

- Then the Product Spec (MVP, phase2, phase3) with user stories and acceptance criteria.

- Then UX flows & annotated wireframes (textual wireframes + component props). Include 8 named screens with component lists.

- Then Targeting algorithm with pseudocode and sample outputs for 3 user profiles (beginner, intermediate, advanced) and a team example.

- Then Gamification list and anti-cheat approaches.

- Then Data model + API endpoints + sample JSONs.

- Then Integrations & technical stack recommendations.

- Then Security/Privacy checklist and required consents.

- Then Analytics & A/B testing plan.

- Then Roadmap, team, sprint plan and estimates.

- Then QA & testing checklist.

Formatting and style constraints:

- Professional tone. Expert-level detail and reasoning. Use numbered lists and short paragraphs. Prefer concise, actionable bullets.

- Provide examples and sample JSON where requested. Avoid attachments. Keep overall output under ~4000 words but fully comprehensive—if content would exceed that, summarize and provide clearly labelled sections where you will expand further on request.

- "Improve" challenge: before the spec deliverables, include a short prioritized set of suggested improvements and trade-offs (per above).

Tool-specific optimization notes for lovable:

- Produce Figma-ready component names and a JSON-friendly screen schema that can be parsed by a design export tool (provide components with type, props, and sample values).

- When listing API endpoints give REST endpoint, HTTP method, path, required/optional params, and example responses. Provide one GraphQL type example as optional.

- Provide copy-ready microcopy (buttons, toasts, confirmations) and accessibility labels.

- For the targeting algorithm provide both human-readable formulas and clean pseudocode and a small table of sample outputs.

- Where possible, tag each deliverable section so the frontend, backend, and design engineers can pick actionable items.

Healthcare/legal disclaimers (must include):

- Provide recommended short in-app disclaimer text (one sentence) and longer T&C snippet for sign-up explaining app is not medical advice and users should consult health professionals before starting a high-intensity program. Provide recommended age gating language.

Clarifying assumptions (use them; also flag anything you need clarified):

- Assume users are adults 18+, but include plan for age-gating minors.

- Assume minimal hardware sensors; users can manually log push-ups.

Please follow the Deliverable output format exactly and produce the prioritized improvement list first (max 350 words for that section). After the full deliverables, include a short "Questions to finalize scope" list (3–6 items).

Healthcare/legal short disclaimers to embed (example):

- "Not medical advice. Consult your GP or physiotherapist before increasing exercise intensity."

Scoring: After generating the prompt deliverable, give a self-assessment score (0-100) for clarity, specificity, contextRichness, constraintQuality, outputDefinition, toolFit, and overall quality (integers). Include these scores in the response metadata at the end.

Begin by listing suggested improvements (prioritized) and trade-offs, then proceed with the full specification per the Output Format.

References:
- https://www.thepushupchallenge.com.au/
- https://www.thepushupchallenge.com.au/resources/the-app
- https://apps.apple.com/au/app/push-for-better/id1549769872

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://push-hub.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/94d0ad46-4925-464d-b196-b864fc1a7c37).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
