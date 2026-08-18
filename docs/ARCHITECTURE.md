# ReproFlow — Product & Technical Architecture

*"Record a problem once. Reproduce it instantly."*

This document is the single source of truth for ReproFlow's architecture, schema, APIs, flows,
security/privacy plan, and implementation roadmap. All code in this repository must conform to
the naming conventions, entities, and flows defined here. When a later phase needs to deviate,
update this document in the same change.

**Stack decision (locked in):** TypeScript everywhere — NestJS API, PostgreSQL, Redis, S3-compatible
object storage (MinIO locally, AWS S3/Cloudflare R2 in production), BullMQ workers with FFmpeg,
Next.js dashboard, Manifest V3 extension (React + TypeScript). Local dev runs entirely on Docker
Compose — no cloud accounts required until deployment.

---

## Table of contents

1. [Product architecture](#1-product-architecture)
2. [User journeys](#2-user-journeys)
3. [MVP feature list](#3-mvp-feature-list)
4. [Post-MVP roadmap](#4-post-mvp-roadmap)
5. [Technical architecture](#5-technical-architecture)
6. [Database schema](#6-database-schema)
7. [API specification](#7-api-specification)
8. [Extension folder structure](#8-extension-folder-structure)
9. [Dashboard folder structure](#9-dashboard-folder-structure)
10. [Authentication flow](#10-authentication-flow)
11. [Recording flow](#11-recording-flow)
12. [Screenshot flow](#12-screenshot-flow)
13. [Technical context capture flow](#13-technical-context-capture-flow)
14. [Privacy redaction flow](#14-privacy-redaction-flow)
15. [Upload flow](#15-upload-flow)
16. [Offline mode](#16-offline-mode)
17. [Report generation flow](#17-report-generation-flow)
18. [Share link flow](#18-share-link-flow)
19. [Integration flow](#19-integration-flow)
20. [Security plan](#20-security-plan)
21. [Privacy plan](#21-privacy-plan)
22. [Pricing model](#22-pricing-model)
23. [Testing plan](#23-testing-plan)
24. [Deployment plan](#24-deployment-plan)
25. [Monitoring plan](#25-monitoring-plan)
26. [Chrome Web Store permission justifications](#26-chrome-web-store-permission-justifications)
27. [User-facing privacy policy requirements](#27-user-facing-privacy-policy-requirements)
28. [Complete implementation roadmap](#28-complete-implementation-roadmap)

---

## 1. Product architecture

```
                        ┌─────────────────────────┐
                        │   Chrome Extension (MV3) │
                        │  Popup/Side Panel (React)│
                        │  Content Script           │
                        │  Service Worker           │
                        │  IndexedDB (drafts/queue)│
                        └────────────┬──────────────┘
                                     │ HTTPS (JWT access token)
                                     ▼
                        ┌─────────────────────────┐
                        │   API Gateway (NestJS)   │
                        │  Auth · Orgs · Projects   │
                        │  Reports · Comments       │
                        │  Share links · Integrations│
                        │  Signed upload URLs       │
                        └───┬──────────┬────────────┘
                            │          │
                 ┌──────────┘          └───────────┐
                 ▼                                 ▼
        ┌────────────────┐               ┌──────────────────┐
        │  PostgreSQL     │               │  Redis            │
        │  (system of      │               │  sessions/cache/   │
        │   record)        │               │  BullMQ queues     │
        └────────────────┘               └─────────┬─────────┘
                                                     │
                                                     ▼
                                          ┌───────────────────────┐
                                          │  Background Workers    │
                                          │  (BullMQ consumers)    │
                                          │  · Video transcode     │
                                          │    (FFmpeg)            │
                                          │  · Malware scan        │
                                          │  · Integration dispatch│
                                          │    (GitHub/Slack)      │
                                          │  · Report export        │
                                          │    (PDF/HTML)           │
                                          │  · Notification fanout │
                                          └───────────┬─────────────┘
                                                       │
                                                       ▼
                                          ┌───────────────────────┐
                                          │ S3-compatible storage  │
                                          │ (attachments, exports) │
                                          │ MinIO (dev) / S3 (prod)│
                                          └───────────────────────┘

                        ┌─────────────────────────┐
                        │   Dashboard (Next.js)    │
                        │  Org/Project/Report UI    │
                        │  Same API as extension    │
                        └────────────┬──────────────┘
                                     │
                                     ▼
                              API Gateway (above)
```

**Core components**

| Component | Responsibility |
|---|---|
| Extension | Capture (screenshot/recording/tech context), local redaction, local drafts, upload queue |
| API (NestJS) | AuthN/AuthZ, org/project/report CRUD, signed upload URL issuance, share links, integration config, webhooks |
| Workers (BullMQ) | Video transcode + compression (FFmpeg), attachment malware scan, GitHub/Slack/Jira/Linear dispatch, PDF/HTML export rendering, email/notification fanout |
| PostgreSQL | System of record for all entities |
| Redis | Session/rate-limit cache, BullMQ job queues, pub/sub for real-time status |
| Object storage | Screenshots, recordings, exports — always via short-lived signed URLs, never public |
| Dashboard (Next.js) | Web UI for triage, sharing, integration setup, org/user settings |
| AI service adapter | Optional, provider-pluggable (OpenAI/Anthropic/local), only invoked with explicit org opt-in |

---

## 2. User journeys

### 2.1 Primary reporter (QA / non-technical client / freelancer)
1. Installs extension from Chrome Web Store → onboarding popup explains permissions.
2. Signs up (email+password or SSO) or logs in.
3. Selects existing project or creates one ("Client X Website").
4. Browses to the buggy page.
5. Clicks extension icon → side panel opens with **"Report a bug"**.
6. Chooses capture mode: Screenshot / Recording / Screenshot+Recording / Technical-context-only.
7. Captures (screen picker for recording, instant grab for screenshot).
8. Describes issue in own language (English/Urdu/Roman Urdu/etc.); fills expected vs actual.
9. Reproduction steps entered (freeform or numbered list, AI-assist optional).
10. Reviews auto-captured technical context (console errors, network failures, browser/OS).
11. **Privacy review screen** — sees detected sensitive items, masks/blurs/crops/removes.
12. Sees live **Report Quality Score** with suggestions.
13. Submits → upload progress shown → private share link generated.
14. Optionally sends directly to GitHub/Jira/Linear/Slack from the confirmation screen.

### 2.2 Developer / triager (dashboard)
1. Logs into dashboard, switches to correct organisation.
2. Sees report list filtered by "Assigned to me" / status=New.
3. Opens report → views screenshot/recording, tech context, reproduction steps.
4. Comments, changes status (New → Triaged → In Progress → Resolved), reassigns.
5. Sends to GitHub as an issue (or confirms it was already sent), sees the sync status.
6. Exports report as PDF/Markdown for a client email if needed.

### 2.3 Org owner/admin (setup)
1. Creates organisation, invites team (email invite with role).
2. Creates projects, sets per-project integration targets (GitHub repo, Slack channel).
3. Configures retention policy, storage usage view, AI settings (off by default).
4. Manages billing plan (data model ready; payment processing not activated in MVP).

### 2.4 External stakeholder (share-link viewer)
1. Receives a private share link (and password, if set) via chat/email.
2. Opens link → optional password prompt → read-only report view (no login required).
3. Cannot see other reports, cannot edit, page is `noindex`.
4. Original reporter/admin can revoke the link at any time; audit log records every access.

---

## 3. MVP feature list

Direct mapping of the required MVP scope (A–AJ) to build status. Everything below is **in scope
for Phase 1–4** of the roadmap (§28); nothing here is a placeholder.

| # | Feature | Notes |
|---|---|---|
| A | Chrome MV3 extension | React + TypeScript, side panel UI |
| B | User authentication | Email+password, JWT access + rotating refresh token |
| C | Org & project management | Roles: Owner/Admin/Developer/Reporter/Viewer |
| D | Screenshot capture | `chrome.tabs.captureVisibleTab` |
| E | Short screen recording | `getDisplayMedia` + `MediaRecorder`, capped duration |
| F | Optional mic recording | Explicit toggle, default off |
| G | Optional tab audio | Explicit toggle, default off |
| H | User description | Free text, multi-language |
| I | Expected result | Free text |
| J | Actual result | Free text |
| K | Reproduction steps | Ordered list, add/remove/reorder |
| L | Severity | Critical/High/Medium/Low |
| M | Priority | Urgent/High/Normal/Low |
| N | Frequency | Always/Often/Sometimes/Rarely/Once |
| O | Browser metadata | Parsed from UA + `navigator` |
| P | OS | Parsed from UA client hints where available |
| Q | Browser version | Same |
| R | Viewport dimensions | `window.innerWidth/innerHeight` |
| S | Current URL | Sanitized (see §13) |
| T | Console errors | Captured via content script console hook |
| U | Failed network requests | Captured via `chrome.webRequest` (status ≥ 400 / failed) |
| V | Manual redaction | Blur/crop/remove tools on screenshot canvas |
| W | Automatic password masking | DOM scan for `type=password` before capture |
| X | Report preview | Full structured preview before submit |
| Y | Secure upload | Signed PUT URLs, chunked for recordings |
| Z | Private share link | Hashed token, optional password, expiry, revoke |
| AA | HTML export | Server-rendered static HTML bundle |
| AB | PDF export | Server-rendered via headless Chromium worker |
| AC | Markdown export | Template-based |
| AD | JSON export | Full structured report |
| AE | GitHub integration | OAuth App, create issue |
| AF | Slack notification | OAuth + incoming webhook, message on submit |
| AG | Low-bandwidth mode | 360p/480p, compressed WebM, size estimate |
| AH | Offline draft mode | IndexedDB draft + queued upload |
| AI | Upload retry | Exponential backoff, manual retry button |
| AJ | Report deletion | Soft delete + hard purge on retention expiry |

---

## 4. Post-MVP roadmap

- Jira and Linear integrations (OAuth + issue creation), following the same integration
  contract as GitHub (§19).
- Video annotation/trimming (basic timeline trim, arrow/text overlays) — explicitly excluded
  from MVP per the prompt's constraints.
- Full Urdu/Roman Urdu **UI** localization (MVP ships English UI with multi-language **input**
  and AI translation of report *content*; UI chrome stays English-first until Phase 6).
- Team analytics dashboards (report trends, resolution time, agency client rollups).
- Billing activation (Stripe), enforcing the plan limits already tracked in `usage_records`.
- AI-assisted severity/duplicate-detection suggestions (still human-approved, never automatic).
- Firefox / Edge-native ports of the extension (MV3 code is written portably where feasible).
- SSO (Google Workspace / Microsoft Entra) for agency/enterprise plans.
- Mobile web report viewer polish (share-link pages are responsive from day one; native app is
  out of scope).

---

## 5. Technical architecture

**Repository layout:** monorepo (`extension/`, `backend/`, `dashboard/`, `infra/`, `docs/`).

**Backend:** NestJS (Fastify adapter) modules: `auth`, `organisations`, `projects`, `reports`,
`attachments`, `technical-context`, `comments`, `share-links`, `integrations`, `ai`, `usage`,
`notifications`, `audit`. Each module owns its Prisma models, DTOs, controller, service, and
guards. Cross-cutting: `common/` (guards, interceptors, pipes), `config/` (typed env), `jobs/`
(BullMQ producers/consumers shared contracts).

**ORM/migrations:** Prisma (typed client, migration history checked into `backend/prisma/migrations`).

**Queues:** BullMQ on Redis, one queue per concern (`video-transcode`, `malware-scan`,
`integration-dispatch`, `export-render`, `notification-fanout`), each with its own concurrency
and retry/backoff policy.

**Storage:** All buckets are private. API issues short-lived (15 min) presigned PUT URLs for
upload and presigned GET URLs for playback/download — the extension and dashboard never receive
long-lived storage credentials.

**Auth:** JWT access token (15 min TTL) + refresh token (httpOnly, rotated on use, revocable,
7-30 day TTL depending on "remember me"). Extension stores tokens in `chrome.storage.session`
(cleared on browser close) with refresh persisted in `chrome.storage.local` encrypted-at-rest by
the OS profile; dashboard uses httpOnly secure cookies.

**Real-time status (upload/integration progress):** Redis pub/sub → SSE endpoint consumed by
both extension and dashboard (`GET /reports/:id/events`), avoiding a WebSocket dependency for MVP.

**AI adapter:** `backend/src/ai/providers/*` implements a common `AiProvider` interface
(`rewriteDescription`, `translate`, `structureSteps`, `suggestSeverity`, `summarizeContext`).
Selected provider + key are stored per-organisation, encrypted with envelope encryption (KMS
data key wraps a per-org key). If no provider is configured, every AI-touched field simply
passes through the user's raw input untouched — no synthetic content is ever generated.

---

## 6. Database schema

PostgreSQL, all primary keys `uuid` (`gen_random_uuid()`), all tables have `created_at`/`updated_at`
(`timestamptz`), soft-deletable tables have `deleted_at`.

```sql
-- ── users ─────────────────────────────────────────────────────────
CREATE TABLE users (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email             citext UNIQUE NOT NULL,
  password_hash     text,                       -- null if SSO-only
  full_name         text NOT NULL,
  avatar_url        text,
  locale            text NOT NULL DEFAULT 'en',
  email_verified_at timestamptz,
  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz
);

-- ── organisations ────────────────────────────────────────────────
CREATE TABLE organisations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name              text NOT NULL,
  slug              text UNIQUE NOT NULL,
  plan              text NOT NULL DEFAULT 'free', -- free|solo|team|agency|enterprise
  owner_id          uuid NOT NULL REFERENCES users(id),
  retention_days    int NOT NULL DEFAULT 90,
  ai_enabled        boolean NOT NULL DEFAULT false,
  analytics_enabled boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz
);

-- ── organisation_members ─────────────────────────────────────────
CREATE TABLE organisation_members (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role            text NOT NULL CHECK (role IN ('owner','admin','developer','reporter','viewer')),
  invited_by      uuid REFERENCES users(id),
  invited_at      timestamptz NOT NULL DEFAULT now(),
  joined_at       timestamptz,
  UNIQUE (organisation_id, user_id)
);
CREATE INDEX idx_org_members_org ON organisation_members(organisation_id);
CREATE INDEX idx_org_members_user ON organisation_members(user_id);

-- ── projects ──────────────────────────────────────────────────────
CREATE TABLE projects (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name            text NOT NULL,
  key             text NOT NULL,             -- short code, e.g. "WEB"
  description     text,
  created_by      uuid NOT NULL REFERENCES users(id),
  archived_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organisation_id, key)
);
CREATE INDEX idx_projects_org ON projects(organisation_id);

-- ── bug_reports ───────────────────────────────────────────────────
CREATE TABLE bug_reports (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id    uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  project_id         uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  reporter_id        uuid NOT NULL REFERENCES users(id),
  assigned_to        uuid REFERENCES users(id),
  title              text NOT NULL,
  summary            text,
  description_raw    text NOT NULL,          -- original language, untouched
  description_lang   text NOT NULL DEFAULT 'en',
  description_dev    text,                   -- AI/manual developer-language version
  description_dev_is_ai boolean NOT NULL DEFAULT false,
  expected_result    text,
  actual_result      text,
  reproduction_steps jsonb NOT NULL DEFAULT '[]', -- [{order, text}]
  severity           text NOT NULL DEFAULT 'medium'
                       CHECK (severity IN ('critical','high','medium','low')),
  priority           text NOT NULL DEFAULT 'normal'
                       CHECK (priority IN ('urgent','high','normal','low')),
  frequency          text CHECK (frequency IN ('always','often','sometimes','rarely','once')),
  status             text NOT NULL DEFAULT 'new'
                       CHECK (status IN ('new','triaged','in_progress','needs_info',
                                          'resolved','closed','duplicate','wont_fix')),
  quality_score       int,                   -- 0-100, computed at submit + recompute
  capture_mode        text NOT NULL
                       CHECK (capture_mode IN ('screenshot','recording','screenshot_recording',
                                                'context_only')),
  affected_url_sanitized text,
  tags                text[] NOT NULL DEFAULT '{}',
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz
);
CREATE INDEX idx_reports_org        ON bug_reports(organisation_id);
CREATE INDEX idx_reports_project    ON bug_reports(project_id);
CREATE INDEX idx_reports_status     ON bug_reports(status);
CREATE INDEX idx_reports_severity   ON bug_reports(severity);
CREATE INDEX idx_reports_created_at ON bug_reports(created_at);
CREATE INDEX idx_reports_assigned   ON bug_reports(assigned_to);
CREATE INDEX idx_reports_reporter   ON bug_reports(reporter_id);

-- ── technical_context ────────────────────────────────────────────
CREATE TABLE technical_context (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bug_report_id    uuid NOT NULL UNIQUE REFERENCES bug_reports(id) ON DELETE CASCADE,
  page_title       text,
  browser_name     text,
  browser_version  text,
  os_name          text,
  viewport_width   int,
  viewport_height  int,
  user_agent_redacted text,
  timezone         text,
  captured_at      timestamptz NOT NULL,
  console_errors   jsonb NOT NULL DEFAULT '[]',   -- [{level, message, source, line, ts}]
  network_failures jsonb NOT NULL DEFAULT '[]',   -- [{url_sanitized, method, status, ts}]
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ── attachments ───────────────────────────────────────────────────
CREATE TABLE attachments (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bug_report_id  uuid NOT NULL REFERENCES bug_reports(id) ON DELETE CASCADE,
  type           text NOT NULL CHECK (type IN ('screenshot','recording','export')),
  storage_key    text NOT NULL,
  mime_type      text NOT NULL,
  size_bytes     bigint NOT NULL,
  width          int,
  height         int,
  duration_ms    int,
  checksum_sha256 text NOT NULL,
  scan_status    text NOT NULL DEFAULT 'pending'
                   CHECK (scan_status IN ('pending','clean','infected','error')),
  redaction_applied boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now(),
  deleted_at     timestamptz
);
CREATE INDEX idx_attachments_report ON attachments(bug_report_id);

-- ── comments ──────────────────────────────────────────────────────
CREATE TABLE comments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bug_report_id uuid NOT NULL REFERENCES bug_reports(id) ON DELETE CASCADE,
  author_id     uuid NOT NULL REFERENCES users(id),
  body          text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);
CREATE INDEX idx_comments_report ON comments(bug_report_id);

-- ── share_links ───────────────────────────────────────────────────
CREATE TABLE share_links (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bug_report_id  uuid NOT NULL REFERENCES bug_reports(id) ON DELETE CASCADE,
  token_hash     text NOT NULL UNIQUE,        -- sha256 of the random token; raw token never stored
  password_hash  text,                        -- optional, bcrypt
  created_by     uuid NOT NULL REFERENCES users(id),
  expires_at     timestamptz,
  revoked_at     timestamptz,
  last_accessed_at timestamptz,
  access_count   int NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_share_links_report ON share_links(bug_report_id);

-- ── integrations ──────────────────────────────────────────────────
CREATE TABLE integrations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  project_id      uuid REFERENCES projects(id) ON DELETE CASCADE,  -- null = org-level default
  provider        text NOT NULL CHECK (provider IN ('github','slack','jira','linear')),
  config          jsonb NOT NULL DEFAULT '{}',  -- non-secret config: repo, channel, project key
  access_token_encrypted  text,
  refresh_token_encrypted text,
  connected_by    uuid NOT NULL REFERENCES users(id),
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active','error','disconnected')),
  last_error      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_integrations_org ON integrations(organisation_id);

-- ── audit_logs ────────────────────────────────────────────────────
CREATE TABLE audit_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid REFERENCES organisations(id) ON DELETE CASCADE,
  actor_id        uuid REFERENCES users(id),
  action          text NOT NULL,             -- e.g. 'report.deleted', 'share_link.revoked'
  resource_type   text NOT NULL,
  resource_id     uuid,
  metadata        jsonb NOT NULL DEFAULT '{}',
  ip_address      inet,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_org        ON audit_logs(organisation_id);
CREATE INDEX idx_audit_created_at ON audit_logs(created_at);

-- ── usage_records ─────────────────────────────────────────────────
CREATE TABLE usage_records (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  period_start    date NOT NULL,
  period_end      date NOT NULL,
  reports_count       int NOT NULL DEFAULT 0,
  recording_minutes    numeric(10,2) NOT NULL DEFAULT 0,
  storage_bytes         bigint NOT NULL DEFAULT 0,
  team_members_count    int NOT NULL DEFAULT 0,
  projects_count        int NOT NULL DEFAULT 0,
  integrations_count    int NOT NULL DEFAULT 0,
  ai_requests_count     int NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organisation_id, period_start)
);
CREATE INDEX idx_usage_org ON usage_records(organisation_id);

-- ── notifications ─────────────────────────────────────────────────
CREATE TABLE notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       text NOT NULL,       -- 'report_assigned','comment_added','integration_failed', ...
  payload    jsonb NOT NULL DEFAULT '{}',
  read_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user ON notifications(user_id);
```

---

## 7. API specification

Base path `/api/v1`. Auth via `Authorization: Bearer <access_token>` except where noted. All
mutating endpoints require CSRF-safe transport (bearer token, not cookie, for extension/dashboard
XHR) and are rate-limited (see §20).

| Method & path | Auth | Purpose |
|---|---|---|
| `POST /auth/signup` | none | Create user + first organisation |
| `POST /auth/login` | none | Email/password → access+refresh token |
| `POST /auth/refresh` | refresh token | Rotate refresh, issue new access token |
| `POST /auth/logout` | access | Revoke refresh token |
| `POST /auth/verify-email` | none (token) | Confirm email |
| `GET  /me` | access | Current user + org memberships |
| `GET  /organisations` | access | List orgs the user belongs to |
| `POST /organisations` | access | Create org |
| `PATCH /organisations/:id` | access (admin+) | Update org settings |
| `DELETE /organisations/:id` | access (owner) | Soft-delete org (confirmation flow) |
| `POST /organisations/:id/invites` | access (admin+) | Invite member by email+role |
| `PATCH /organisations/:id/members/:userId` | access (admin+) | Change role |
| `DELETE /organisations/:id/members/:userId` | access (admin+) | Remove member |
| `GET  /projects?organisationId=` | access | List projects |
| `POST /projects` | access (admin+) | Create project |
| `PATCH /projects/:id` | access (admin+) | Update/archive |
| `GET  /reports` | access | List, filterable (status, severity, priority, assignee, reporter, dateFrom/To, browser, os, tags, q) |
| `POST /reports` | access (reporter+) | Create report (see §17) |
| `GET  /reports/:id` | access (role-checked) | Full report detail |
| `PATCH /reports/:id` | access (role-checked) | Update fields/status/assignment |
| `DELETE /reports/:id` | access (admin/owner or author) | Soft delete |
| `GET  /reports/:id/events` | access | SSE stream: upload/integration progress |
| `POST /reports/:id/comments` | access | Add comment |
| `GET  /reports/:id/comments` | access | List comments |
| `POST /reports/:id/attachments/init` | access | Request presigned upload URL(s) (chunked) |
| `POST /reports/:id/attachments/:attId/complete` | access | Mark upload complete → triggers scan+transcode job |
| `GET  /reports/:id/attachments/:attId/url` | access | Short-lived presigned GET URL |
| `POST /reports/:id/technical-context` | access | Attach captured technical context |
| `GET  /reports/:id/quality-score` | access | Recompute + return quality score breakdown |
| `POST /reports/:id/export` | access | Enqueue export job (`format: html|pdf|md|json`) |
| `GET  /exports/:jobId` | access | Export job status + download URL when ready |
| `POST /reports/:id/share-links` | access (admin/owner/author) | Create share link |
| `GET  /reports/:id/share-links` | access | List active links + access audit |
| `DELETE /share-links/:id` | access | Revoke |
| `GET  /public/share/:token` | none (+ optional password) | Read-only report view |
| `POST /projects/:id/integrations` | access (admin+) | Connect integration (OAuth callback finalize) |
| `DELETE /integrations/:id` | access (admin+) | Disconnect |
| `POST /reports/:id/integrations/:provider/send` | access | Dispatch report to GitHub/Slack/Jira/Linear |
| `GET  /organisations/:id/usage` | access (admin+) | Usage vs plan limits |
| `GET  /organisations/:id/audit-logs` | access (admin+) | Paginated audit trail |
| `PATCH /organisations/:id/ai-settings` | access (owner/admin) | Provider, key, enable/disable, limits |
| `DELETE /organisations/:id/ai-history` | access (owner/admin) | Purge stored AI request logs |
| `POST /ai/rewrite` | access (if AI enabled) | Rewrite description/steps (returns marked-generated text) |
| `POST /ai/translate` | access (if AI enabled) | Translate raw description → developer language |
| `GET  /health` | none | Liveness/readiness |

All list endpoints are cursor-paginated (`?cursor=&limit=`, max `limit=100`). All error responses
follow `{ error: { code, message, details? } }` with a stable `code` enum for client handling.

---

## 8. Extension folder structure

```
extension/
├─ manifest.json
├─ package.json / tsconfig.json / vite.config.ts (CRXJS plugin)
├─ src/
│  ├─ background/
│  │  ├─ service-worker.ts        # MV3 background entry; message router
│  │  ├─ capture/
│  │  │  ├─ screenshot.ts         # chrome.tabs.captureVisibleTab
│  │  │  ├─ recording-controller.ts # tabCapture/getDisplayMedia orchestration
│  │  │  └─ network-monitor.ts    # chrome.webRequest failed/4xx/5xx capture
│  │  ├─ upload/
│  │  │  ├─ upload-queue.ts       # chunked upload, retry/backoff
│  │  │  └─ signed-url-client.ts
│  │  └─ auth/
│  │     └─ token-store.ts        # chrome.storage.session + refresh rotation
│  ├─ content-scripts/
│  │  ├─ console-hook.ts          # wraps console.error/warn, posts to background
│  │  ├─ dom-scanner.ts           # password fields, PII pattern scan for redaction hints
│  │  └─ page-context.ts          # title, viewport, sanitized URL extraction
│  ├─ panel/                       # React side-panel app
│  │  ├─ App.tsx
│  │  ├─ routes/
│  │  │  ├─ Login.tsx
│  │  │  ├─ ProjectSelect.tsx
│  │  │  ├─ CaptureMode.tsx
│  │  │  ├─ Recorder.tsx           # timer, pause, quality selector, audio toggles
│  │  │  ├─ Annotate.tsx           # blur/crop/manual redaction canvas
│  │  │  ├─ ReportForm.tsx         # description/expected/actual/steps/severity/etc.
│  │  │  ├─ TechnicalContextReview.tsx
│  │  │  ├─ PrivacyReview.tsx      # detected sensitive items + actions
│  │  │  ├─ ReportPreview.tsx      # + quality score
│  │  │  ├─ UploadProgress.tsx     # retry/offline-save controls
│  │  │  └─ ShareConfirmation.tsx  # link + send-to-integration buttons
│  │  ├─ components/               # buttons, badges, RecordingTimer, StatusPill
│  │  └─ state/                    # Zustand store: draft, capture, network status
│  ├─ lib/
│  │  ├─ api-client.ts
│  │  ├─ redaction/
│  │  │  ├─ pii-patterns.ts        # email/phone/card/JWT/API-key/CNIC regexes
│  │  │  └─ image-redactor.ts      # canvas blur/crop ops
│  │  ├─ offline/
│  │  │  ├─ draft-store.ts         # IndexedDB drafts
│  │  │  └─ queue-store.ts         # IndexedDB pending uploads
│  │  └─ sanitize-url.ts
│  └─ i18n/
│     ├─ en.json
│     ├─ ur.json
│     └─ ur-Roman.json
├─ public/icons/
└─ tests/
   ├─ unit/
   └─ e2e/ (Playwright + chrome extension loading)
```

---

## 9. Dashboard folder structure

```
dashboard/
├─ package.json / next.config.ts / tsconfig.json
├─ src/
│  ├─ app/
│  │  ├─ (auth)/login/page.tsx
│  │  ├─ (auth)/signup/page.tsx
│  │  ├─ (app)/[org]/projects/page.tsx
│  │  ├─ (app)/[org]/projects/[projectId]/reports/page.tsx
│  │  ├─ (app)/[org]/reports/[reportId]/page.tsx
│  │  ├─ (app)/[org]/settings/organisation/page.tsx
│  │  ├─ (app)/[org]/settings/members/page.tsx
│  │  ├─ (app)/[org]/settings/integrations/page.tsx
│  │  ├─ (app)/[org]/settings/privacy/page.tsx
│  │  ├─ (app)/[org]/settings/ai/page.tsx
│  │  ├─ (app)/[org]/settings/billing/page.tsx
│  │  ├─ share/[token]/page.tsx      # public read-only, noindex
│  │  └─ api/auth/[...]/route.ts     # BFF proxy for httpOnly cookie session
│  ├─ components/
│  │  ├─ reports/ (ReportTable, Filters, StatusBadge, SeverityBadge)
│  │  ├─ report-detail/ (AttachmentViewer, Timeline, CommentThread, ShareLinkPanel)
│  │  └─ ui/ (design-system primitives)
│  ├─ lib/ (api-client.ts, auth.ts, permissions.ts)
│  └─ i18n/
└─ tests/
   ├─ unit/
   └─ e2e/ (Playwright)
```

---

## 10. Authentication flow

1. **Signup** — extension or dashboard posts `{email, password, fullName, orgName}` →
   `POST /auth/signup`. Backend hashes password (argon2id), creates `users` + `organisations`
   (role `owner`) + `organisation_members` rows in one transaction, sends verification email.
2. **Login** — `POST /auth/login` validates credentials, rate-limited (5/min/IP, 10/min/account),
   issues access token (JWT, 15 min, org memberships embedded) + refresh token (opaque, stored
   hashed in Redis with TTL, rotated every use).
3. **Token storage** — dashboard: refresh token in httpOnly `Secure; SameSite=Lax` cookie, access
   token in memory. Extension: access token in `chrome.storage.session`; refresh token in
   `chrome.storage.local` (never in content-script-reachable context — background-worker only).
4. **Refresh** — background worker calls `POST /auth/refresh` proactively before expiry and on
   401; old refresh token is invalidated (rotation), reuse of a revoked token revokes the whole
   family (breach detection).
5. **Logout** — revokes the current refresh token family server-side; clears local storage.
6. Every request re-derives role/permission from `organisation_members` server-side — the JWT's
   embedded roles are a cache hint only, never trusted for authorization decisions on writes.

---

## 11. Recording flow

1. User clicks **Start recording** in the side panel → picks quality (360p/480p/720p default)
   and audio options (mic off, tab audio off by default).
2. Extension calls `chrome.desktopCapture`/`getDisplayMedia` scoped to **tab or a chosen
   screen/window only** — the picker is native Chrome UI, so the user explicitly selects the
   source; ReproFlow never auto-selects.
3. A **persistent recording-status badge** renders in the side panel and as a `chrome.action`
   badge (red dot + timer) for the entire duration — visible regardless of which tab is focused.
4. `MediaRecorder` streams `video/webm;codecs=vp9` (or vp8 fallback) chunks into memory/IndexedDB
   as they arrive (not held only in a single in-memory blob) so a crash loses at most one chunk.
5. **Pause/resume** stops/restarts `MediaRecorder` without dropping the source stream.
6. Max duration enforced client-side (default 5 min, configurable per plan) — recording
   auto-stops with a visible notice, never silently truncates without telling the user.
7. On **Stop**, recording moves to the Annotate step — nothing is uploaded yet.
8. Low-bandwidth mode re-encodes via `MediaRecorder` bitrate caps + downsampled `getDisplayMedia`
   constraints (`width/height` ideal 640×360) instead of a post-hoc transcode, keeping the local
   file small from the start; server-side FFmpeg worker still normalizes/compresses further on
   ingest for consistent playback.

---

## 12. Screenshot flow

1. User clicks **Screenshot** → background worker calls `chrome.tabs.captureVisibleTab` for the
   active tab only.
2. Content script first runs `dom-scanner.ts` to locate `input[type=password]` bounding boxes
   and known sensitive-looking fields **before** the pixel capture completes, so coordinates are
   ready for auto-masking.
3. Captured PNG is drawn to an offscreen canvas; auto-mask rectangles are painted over password
   field regions immediately (§14) before the image ever reaches the Annotate UI.
4. User lands on `Annotate.tsx` with manual blur/crop/remove tools layered on the auto-masked
   base image.
5. Full-page (scrolling) capture is a stretch item stitched from multiple `captureVisibleTab`
   calls + scroll-and-wait; MVP ships viewport-only capture to keep behavior predictable and
   avoid capturing off-screen content the user didn't intend to share.

---

## 13. Technical context capture flow

1. On report start, content script snapshots: `document.title`, sanitized `location.href`,
   `innerWidth/innerHeight`, `navigator.userAgentData` (or UA string parsed via `ua-parser-js`
   fallback), `Intl.DateTimeFormat().resolvedOptions().timeZone`.
2. `console-hook.ts` (injected at document start) has been buffering `console.error`/`console.warn`
   calls in a capped ring buffer (last 50) since the tab loaded — no page reload needed.
3. `network-monitor.ts` (background, via `chrome.webRequest.onCompleted`/`onErrorOccurred` scoped
   only to the active tab's requests during the report session) records failed/≥400 requests:
   URL, method, status, timestamp — **query strings and fragments stripped**, request/response
   bodies never read, headers never captured.
4. `sanitize-url.ts` strips known sensitive query keys (`token`, `session`, `sid`, `password`,
   `email`, `key`, `auth`, `access_token`, plus a configurable deny-list) and any parameter value
   matching JWT/API-key shape, from both the affected URL and every network-failure URL.
5. User reviews everything on `TechnicalContextReview.tsx` — every field is editable/removable
   before it's ever attached to the report.
6. Only on explicit "Continue" does this payload get included in the draft; it is never sent to
   the API until the final submit step.

---

## 14. Privacy redaction flow

1. **Detection** (`pii-patterns.ts`, runs entirely client-side, on-device): regex/heuristic scan
   of visible DOM text nodes and the captured image's OCR-free heuristics (form field types,
   `autocomplete` attributes) for: password fields, email addresses, phone numbers, credit-card-
   like digit sequences (Luhn-checked), API-key/token-shaped strings, JWT-shaped strings
   (`xxx.yyy.zzz` base64url), CNIC/national-ID-shaped numbers, and the current page's own
   sensitivity (e.g. banking/admin paths).
2. **Automatic masking**: password fields are masked in screenshots *before* the user ever sees
   the unmasked capture (§12); this cannot be disabled below "hidden" — only made stricter.
3. **Privacy Review screen** shows every detected item as a card: type, location (thumbnail
   crop), and actions — **Approve** (leave visible), **Blur**, **Crop out**, **Remove entire
   screenshot/recording/technical-context/network-details**.
4. Manual tools: freehand/rectangle blur brush and crop on the screenshot canvas; for recordings,
   a redaction is a static blur-region overlay burned in during server-side transcode (MVP does
   not support time-varying blur regions — flagged as post-MVP; if a user needs to hide something
   that moves, MVP guidance is "remove the recording, keep the screenshot").
5. The screen always displays: *"Review this report before sending. Recordings and technical
   data may contain information visible on the selected website."* — and a second line stating
   detection is heuristic: *"Automatic detection may miss sensitive content — please review
   carefully."*
6. Nothing proceeds past this screen silently; **Continue** is a distinct explicit action from
   any individual item's Approve/Blur/Remove.

---

## 15. Upload flow

1. On submit, client requests `POST /reports/:id/attachments/init` with attachment
   type/size/mime → API validates size/type against plan limits and returns one or more
   presigned PUT URLs (multipart, 5-10MB chunks for recordings).
2. Client uploads chunks directly to object storage (bypasses API for bandwidth), reporting
   per-chunk progress to `UploadProgress.tsx`.
3. **Explicit confirmation gate**: the actual "Submit report" click *is* the upload-confirmation
   — nothing is uploaded during capture/edit/review, satisfying "never upload without explicit
   confirmation."
4. On chunk failure: exponential backoff retry (1s/2s/4s/8s, max 5 attempts), then surfaces a
   **Retry** button; partial progress is preserved (completed chunks aren't re-sent).
5. On all chunks complete, client calls `.../attachments/:id/complete` → API marks attachment
   `pending` scan, enqueues `malware-scan` then `video-transcode` (if video) jobs.
6. Client subscribes to `GET /reports/:id/events` (SSE) to reflect scan/transcode progress; report
   is visible in the dashboard immediately with attachments marked "processing" until workers finish.
7. If the network drops entirely mid-upload, the draft (with completed-chunk bookkeeping) falls
   back to the offline queue (§16) rather than failing outright.

---

## 16. Offline mode

1. Every draft (form fields, screenshot blob, recording chunks, technical context) is written to
   IndexedDB (`draft-store.ts`) continuously as the user works — not just at submit time.
2. A persistent network-status indicator in the panel shows Online/Offline; going offline never
   blocks continued editing.
3. If **Submit** is pressed while offline (or upload fails after retries), the draft moves to
   `queue-store.ts` (IndexedDB) with status `queued`, and the user sees an **"Offline save"**
   confirmation with an estimated upload size.
4. A background alarm (`chrome.alarms`) periodically checks connectivity and, when online,
   resumes queued uploads automatically (still chunk-resumable per §15); the user can also
   trigger **Retry now** manually.
5. The user can export the entire local report (attachments + JSON) as a downloadable `.zip`
   package at any time from the offline queue, so work is never trapped if upload is unavailable
   long-term.
6. Drafts/queue entries are user-scoped and local-only until upload succeeds — nothing offline is
   ever synced to any server automatically.

---

## 17. Report generation flow

1. `POST /reports` accepts the full structured payload assembled across the panel steps: title,
   description (raw + language), expected/actual, reproduction steps, severity/priority/frequency,
   capture mode, sanitized affected URL, tags, project ID, plus references to the
   already-uploaded attachment IDs and technical-context payload.
2. If AI is enabled for the org, the client may have called `/ai/rewrite`, `/ai/translate`,
   `/ai/structure-steps` earlier in the flow — every AI output field carries an
   `*_is_ai: boolean` flag and is rendered with a **"Generated"** badge in the UI; the raw
   user text (`description_raw`) is always preserved unchanged alongside it.
3. Server never fabricates severity, console errors, or network failures — those fields are
   either exactly what the client captured/chose, or null/empty. The `quality-score` endpoint
   computes a score from *presence* of fields, never from inferred content.
4. On create, the API assigns status `new`, computes the initial quality score, writes an
   `audit_logs` row, and enqueues a `notification-fanout` job (assignee/watchers) plus any
   configured Slack notification.
5. Response includes the created report + a freshly generated private share link, satisfying
   "receive a private share link" immediately on submit.

---

## 18. Share link flow

1. `POST /reports/:id/share-links` — caller must be the report's author, an admin, or the owner.
   Server generates a 256-bit random token, returns the **raw token to the client once**, and
   stores only `sha256(token)` in `token_hash`. Optional `password` is bcrypt-hashed;
   optional `expiresInDays`.
2. Before creation, the UI shows the required warning: *"Anyone with this link (and password, if
   set) can view this report without logging in. Only share it with people you trust."*
3. `GET /public/share/:token` — no auth required. Server hashes the incoming token and looks up
   by `token_hash`; checks `revoked_at IS NULL` and `expires_at > now()`; if a password is set,
   requires it (rate-limited to prevent brute force). Renders read-only report data — no edit
   affordances, no navigation to other org data.
4. Response sets `X-Robots-Tag: noindex, nofollow` and the page includes `<meta name="robots"
   content="noindex,nofollow">`; sitemap/robots.txt never reference share paths.
5. Every access increments `access_count`, updates `last_accessed_at`, and writes an `audit_logs`
   row (IP, timestamp) visible to the org in `ShareLinkPanel`.
6. **Revoke** sets `revoked_at`; subsequent access attempts return 404 (not 403, to avoid leaking
   existence). There is no public listing of any org's share links or reports anywhere.

---

## 19. Integration flow

Common contract (`backend/src/integrations/providers/*`) implements:
`connect(orgId, oauthCode) → storeEncryptedTokens`, `send(reportId, providerConfig) → externalRef`,
`disconnect(integrationId)`.

1. **Connect**: Admin clicks "Connect GitHub" in dashboard → standard OAuth App authorization-
   code flow → callback exchanges code for tokens → tokens are envelope-encrypted
   (`access_token_encrypted`) before storing in `integrations`; only non-secret `config`
   (selected repo, channel) is ever returned to the client.
2. **Send**: `POST /reports/:id/integrations/:provider/send` builds the payload defined in the
   prompt (title, description, expected/actual, repro steps, severity, priority, environment,
   report link, attachment links *only if* the target system's viewer will be authenticated/
   permitted — otherwise the share link is used instead of a raw storage URL).
3. Dispatch runs in the `integration-dispatch` worker (not inline in the request) so a slow/failed
   third-party API never blocks report submission; result (`externalRef`, e.g. GitHub issue URL,
   or failure reason) is written back to the report and surfaced via SSE — **integration failures
   always produce a visible error state in the UI**, never a silent no-op.
4. Slack: sends a formatted message to the configured channel via incoming webhook or `chat.postMessage`
   (Slack App with `chat:write` scope) containing title/severity/link — configurable per project
   to fire automatically on submit or only on manual "Send to Slack."
5. **Disconnect**: revokes stored tokens (calls provider revoke endpoint where supported), deletes
   the `integrations` row; existing sent issues are untouched (they're external records now).
6. Jira/Linear (Phase 6, post-MVP) implement the identical `connect/send/disconnect` contract so
   the dashboard's integration UI and the report-send button don't change shape when they're added.

---

## 20. Security plan

- **Transport**: HTTPS-only in production (HSTS), TLS termination at load balancer, internal
  service traffic on a private network.
- **Passwords**: argon2id hashing, minimum length/complexity policy enforced client+server.
- **Sessions**: httpOnly `Secure SameSite=Lax` cookies for dashboard; CSRF tokens on cookie-
  authenticated state-changing routes (bearer-token routes from the extension are inherently
  CSRF-immune).
- **Rate limiting**: Redis-backed sliding window per IP and per account on auth endpoints (5-10
  req/min), per-org limits on report creation and AI calls to contain abuse/cost.
- **CORS**: dashboard origin allow-listed explicitly; extension calls carry no `Origin` browser
  restriction issue since MV3 background requests aren't subject to page CORS, but the API still
  validates a shared extension-ID header against a known list.
- **CSP**: strict `default-src 'self'` on the dashboard; extension pages ship their own MV3 CSP
  (`script-src 'self'`; no remote code execution, no `eval`).
- **File validation**: MIME/type allow-list (`image/png`, `image/webp`, `video/webm`) checked by
  magic bytes server-side (not just extension/declared type), size limits enforced per plan.
- **Malware scanning**: every attachment scanned (ClamAV worker) before `scan_status` flips to
  `clean`; playback/download URLs are withheld until scan passes.
- **Storage**: encryption at rest (SSE-S3/KMS), all object access via short-lived signed URLs,
  buckets never public, versioning + lifecycle rules tied to `retention_days`.
- **Tokens**: refresh tokens opaque + hashed at rest; integration OAuth tokens envelope-encrypted;
  share-link tokens hashed (never stored raw) — see §18.
- **Audit logging**: every privileged action (delete report/org, revoke link, role change,
  integration connect/disconnect, share-link access) writes to `audit_logs`.
- **Secrets**: never logged; structured logger has a redaction middleware for known key names
  (`password`, `token`, `authorization`, `secret`).
- **Data lifecycle**: account deletion, report deletion, and org deletion are soft-delete +
  scheduled hard-purge jobs respecting `retention_days`; deletion cascades are explicit, not
  implicit `ON DELETE CASCADE` at the API layer for anything user-facing (DB FKs use CASCADE for
  referential integrity, but user-initiated deletes go through an audited service method).
- **AI keys**: org-provided API keys encrypted at rest; never exposed in extension bundle or
  client-visible responses; never logged.

---

## 21. Privacy plan

- **Data minimization**: only the fields listed in the prompt's "capture only" list are ever
  collected; cookies, passwords, auth headers, full request/response bodies, payment details, and
  unrelated browsing history are never read by any content script or background worker.
- **On-device first**: PII pattern detection and password-field masking run entirely client-side
  before any network call — detection results are never sent to the server, only the user's
  redaction *decisions* are reflected in the final captured media.
- **Explicit consent gate**: the Privacy Review screen (§14) is mandatory and cannot be skipped;
  the two required user-facing disclosure strings from the prompt are shown verbatim.
- **No training on customer content**: recordings/screenshots/report text are never used to train
  any AI model, ReproFlow's own or a third party's, by default — this is a hard product rule, not
  a per-org toggle, and is restated in the AI settings page's data-processing notice.
- **AI opt-in**: AI features are off by default at the org level; enabling requires configuring a
  provider/key explicitly; every AI-touched field is visibly marked "Generated" and remains
  user-editable before submission (§17).
- **Retention & deletion**: configurable per-org retention window; users can delete individual
  reports, and owners can delete the organisation, both fully honored (hard purge after the
  grace period) rather than merely hidden.
- **Third-party sharing**: data only leaves ReproFlow when a user explicitly triggers a share
  link or an integration send — never as a background sync.

---

## 22. Pricing model

Data model only in MVP — payment processing is **not** activated (per prompt constraint) but the
schema fully supports metering from day one.

| Plan | Reports/mo | Recording minutes/mo | Storage | Team members | Projects | Integrations | AI |
|---|---|---|---|---|---|---|---|
| Free | 25 | 30 | 1 GB | 1 | 1 | GitHub or Slack (1) | Off |
| Solo | 100 | 120 | 10 GB | 1 | 5 | GitHub + Slack | Bring-your-own-key |
| Team | 500 | 600 | 50 GB | 10 | 20 | All | Bring-your-own-key |
| Agency | 2000 | 3000 | 250 GB | 30 | Unlimited | All | Bring-your-own-key |
| Enterprise | Custom | Custom | Custom | Custom | Unlimited | All + SSO | Managed option |

`usage_records` is written to nightly per organisation (rollup job) and read-time-aggregated for
the current partial period on `GET /organisations/:id/usage`; limits are enforced as soft warnings
in MVP (no hard blocking) since billing isn't active yet — flip to hard enforcement when Stripe
is wired in post-MVP.

---

## 23. Testing plan

| Layer | Tooling | Coverage |
|---|---|---|
| Backend unit | Vitest | Services (auth, redaction-adjacent sanitizers, quality-score calc, permission guards), Prisma repository methods against a test schema |
| Backend integration | Vitest + Supertest + Testcontainers (Postgres/Redis/MinIO) | Full request→DB round trips per module, including the auth/permission matrix (owner/admin/developer/reporter/viewer × every endpoint) |
| Extension unit | Vitest + `@types/chrome` mocks | `sanitize-url.ts`, `pii-patterns.ts`, `image-redactor.ts`, `draft-store.ts`, `upload-queue.ts` retry/backoff logic |
| Extension e2e | Playwright (loads unpacked MV3 build) | Full capture→submit journey on Chromium; permission-denial paths (mic/screen/capture denied → graceful error state, not a crash) |
| Dashboard e2e | Playwright | Login, report list/filter, report detail, comment, status change, share-link create/revoke/expire, export downloads, integration connect/send-failure states |
| Security | Manual + automated (OWASP ZAP baseline in CI) | XSS in free-text fields (title/description/comments — verify output-encoding on render), SQLi (parameterized via Prisma — verified via integration tests with injection payloads), auth-bypass attempts on every private route, rate-limit trip tests |
| Cross-platform | Manual matrix (see below) | Chrome/Windows, Chrome/macOS, Chrome/Linux |
| Network conditions | Chrome DevTools throttling + Playwright | Slow 3G upload, offline mid-recording, offline mid-upload, network flap during upload (retry/resume verification) |
| Data edge cases | Unit + integration | Long URLs (>2000 chars), reports with zero attachments (context-only mode), expired/revoked share links (404, not 403), deleted reports (404 across all read paths, audit entry present), duplicate concurrent uploads (idempotency key on attachment init) |
| CI gate | GitHub Actions | Lint + typecheck + unit + integration on every PR; e2e nightly + pre-release |

Explicit scenarios from the prompt's list all map onto the rows above (large/short recordings →
extension unit + e2e with size/duration fixtures; multiple team members → dashboard e2e with
seeded multi-role fixtures; API rate limits → security row's automated trip tests; file-upload
abuse → security row's malicious-MIME/oversized-payload fixtures).

---

## 24. Deployment plan

- **Environments**: `local` (Docker Compose — Postgres, Redis, MinIO, backend, dashboard, worker),
  `staging`, `production`.
- **Backend/worker/dashboard**: containerized (multi-stage Dockerfiles), deployed to a container
  platform (Fly.io, Render, or AWS ECS — infra-agnostic; `infra/` holds `docker-compose.yml` for
  local and a `Dockerfile` per app so any of these targets work without app-code changes).
- **Database migrations**: Prisma migrations run as a release-phase step (`prisma migrate deploy`)
  before new app instances receive traffic; never run migrations from a running app instance.
- **Object storage**: MinIO locally; AWS S3 or Cloudflare R2 in staging/prod, same S3-compatible
  SDK calls throughout (`@aws-sdk/client-s3`), so no code branching by environment.
- **Extension release**: versioned build artifact per release, submitted to Chrome Web Store
  (manual review step is Google's, not ours) with a staged rollout percentage; unpacked build
  available for internal QA before submission.
- **CI/CD**: GitHub Actions — `lint-typecheck-test` on every PR, `build-and-push-images` on merge
  to `main`, manual-approval `deploy-staging` then `deploy-production` workflow dispatch.
- **Config**: all secrets via environment variables / platform secret manager, never committed;
  `backend/src/config` validates env at boot (fail fast on missing/invalid config) using a typed
  schema (e.g. `zod`).
- **Rollback**: previous container image tag kept deployable; DB migrations written to be
  backward-compatible for one release (additive first, destructive changes in a follow-up
  release) so a rollback never leaves the schema ahead of the running code.

---

## 25. Monitoring plan

- **Error tracking**: Sentry (or equivalent) on backend, workers, dashboard, and the extension's
  background/panel contexts — with PII scrubbing rules matching §21 (never send captured page
  content or user PII in error breadcrumbs).
- **Structured logging**: JSON logs (pino) with request-ID correlation across API → worker via
  BullMQ job metadata; redaction middleware for secret-shaped fields (§20).
- **Health checks**: `GET /health` (liveness) and a deeper `/health/ready` (DB, Redis, storage
  connectivity) used by the deploy platform and uptime monitor.
- **Queue monitoring**: BullMQ dashboard (Bull Board) restricted to internal auth, alerting on
  queue depth/stalled-job thresholds per queue (transcode backlog, integration-dispatch failures).
- **Uptime/synthetic checks**: external pinger on `/health` and a synthetic login+report-create
  smoke test on staging after every deploy, and periodically on production.
- **Metrics**: request latency/error-rate histograms per route, upload success/failure rate,
  transcode duration, integration dispatch success rate — exported to the platform's metrics
  backend (Prometheus-compatible) for dashboards/alerts.
- **Alerting**: pager/Slack alert on error-rate spikes, queue backlog, failed migrations, and
  disk/storage-quota thresholds.

---

## 26. Chrome Web Store permission justifications

| Permission | Justification |
|---|---|
| `activeTab` | Capture a screenshot/recording of only the tab the user is actively viewing when they click the extension — no access to other tabs. |
| `tabs` (limited use: title/URL of active tab) | Read the current tab's title and URL to prefill the report's "affected URL" field; not used to track browsing across tabs. |
| `scripting` | Inject the console-hook and DOM-scanner content scripts only into the tab the user is actively reporting on, only after they open the report panel. |
| `storage` | Store auth tokens, local drafts, and the offline upload queue on-device (`chrome.storage` / IndexedDB). |
| `desktopCapture` | Let the user pick a screen/window/tab to record via Chrome's native picker UI — required for the screen-recording feature; the user always makes the source selection themselves. |
| `webRequest` (host permissions scoped to the active tab's origin during an active report session) | Detect failed/error HTTP responses (status + URL only, no bodies/headers) to populate the technical-context "network failures" field; monitoring is only active while a report is being composed for that tab. |
| `alarms` | Periodically check network connectivity to resume queued offline uploads. |
| `identity` (if OAuth-in-extension is used for login) | Support signing in without leaving the browser. |

No `<all_urls>` host permission is requested at install time; any origin access needed for
content-script injection is requested as an optional/activeTab-scoped permission triggered by
user action, per Chrome Web Store's minimal-permissions review guidance.

---

## 27. User-facing privacy policy requirements

The published privacy policy must plainly disclose:

1. What is captured (screenshot/recording pixels, form-field *presence* not values except where
   the user explicitly leaves a detected item unmasked, console errors, sanitized network-failure
   metadata, browser/OS/viewport, sanitized URLs) and what is **never** captured (cookies,
   passwords, auth headers/tokens, full request/response bodies, payment details, browsing
   history outside the reported tab).
2. That recording/screenshot capture is always user-initiated and never automatic or background.
3. That automatic sensitive-content detection is heuristic and may miss things — the user is
   responsible for reviewing the Privacy Review screen before submitting.
4. Where data is stored (region, provider), how long it's retained (org-configurable, default 90
   days), and how to request deletion (self-serve report/account/org deletion, honored via hard
   purge after a grace period).
5. Who can access a report (org members per role, plus anyone holding a share link — with a clear
   statement that share links are bearer-access unless password-protected).
6. Third-party processors: object storage provider, error-tracking provider, and — only if the
   org has opted in — the AI provider they configured, with an explicit statement that content is
   **not** used to train ReproFlow's or any third party's models by default.
7. Contact/DPO information and the process for a user or their organisation to export/delete all
   of their data (GDPR/local-law-styled rights, offered regardless of jurisdiction).
8. Cookie/local-storage usage disclosure for the dashboard (session cookie, no third-party
   tracking cookies).

---

## 28. Complete implementation roadmap

Each phase keeps the entities/naming from §6-9 unchanged; later phases only add columns/modules,
never rename existing ones without a migration note here.

**Phase 0 — Foundations** *(this session)*
- Monorepo scaffold, this architecture document, Docker Compose infra, CI skeleton.

**Phase 1 — Auth + Org/Project core**
- Backend: `auth`, `organisations`, `projects` modules + Prisma schema/migrations for
  `users`, `organisations`, `organisation_members`, `projects`.
- Dashboard: login/signup, org switcher, project list (empty/loading/error states).
- Extension: login screen, project selector, token storage.

**Phase 2 — Capture core (screenshot + report form, no recording yet)**
- Extension: screenshot capture, DOM password-field scan + auto-mask, manual blur/crop, report
  form (description/expected/actual/steps/severity/priority/frequency), technical-context capture
  (console + sanitized URL; network-failure capture), Privacy Review screen, Report Preview +
  quality score.
- Backend: `reports`, `technical-context`, `attachments` (init/complete + presigned URLs),
  quality-score endpoint.
- Dashboard: report list + detail (read), comments.

**Phase 3 — Recording + low-bandwidth + offline**
- Extension: `getDisplayMedia` recording, pause/resume, timer, quality selector, audio toggles,
  low-bandwidth mode, IndexedDB draft store + offline queue + retry/backoff, local export package.
- Backend/workers: chunked upload finalize, malware-scan + FFmpeg transcode jobs, SSE progress.

**Phase 4 — Sharing + export + deletion**
- Backend: `share-links` (create/revoke/password/expiry/audit), export jobs (HTML/PDF/MD/JSON),
  report/org/account deletion (soft delete + purge job).
- Dashboard: share-link panel, export buttons, deletion flows with confirmation.

**Phase 5 — Integrations (GitHub, Slack) + notifications**
- Backend: `integrations` module, GitHub OAuth + issue creation, Slack OAuth/webhook + message
  send, `integration-dispatch` worker, `notifications` + fanout job.
- Dashboard: integration settings, send-status on report detail.
- Extension: "send to GitHub/Slack" on the share-confirmation screen.

**Phase 6 — AI (optional) + translation + Urdu/Roman Urdu input**
- Backend: `ai` module with pluggable provider adapter, AI settings endpoints, usage limiting.
- Extension/dashboard: AI settings page, "Generated" badges, translation UI, multi-language input
  already supported from Phase 2 (free-text fields are language-agnostic) — this phase adds the
  actual translate/rewrite calls.

**Phase 7 — Hardening + full test suite + deployment**
- Full unit/integration/e2e suites per §23, security pass (rate limiting, CSP, ZAP baseline),
  monitoring/alerting wired per §25, staging + production deployment per §24, Chrome Web Store
  submission with the justifications from §26, published privacy policy per §27.

**Phase 8 — Post-MVP** — see §4.

Each phase ends in a working, demoable slice — no phase ships a UI control that doesn't yet do
what it says.
