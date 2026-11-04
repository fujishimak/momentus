# AGENTS.md — Momentus

Operating guide for any agent or developer working in this repository. Read this
before making changes. It encodes the tooling, workflow, and quality gates this
project commits to.

## 1. What this project is

Momentus is a local-first daily micro-journal PWA for aspiring speakers and
improvisers: capture a brief statement about your day (audio ≤60s or text ≤150
words), optionally one photo, with timestamp + location metadata. Entries are
stored locally and are searchable/summarisable via on-device AI.

Planning docs live in the Obsidian vault under `Momentus/` (requirements,
design, tasks). Treat `requirements.md` as the source of truth for scope.
**Amendment 2 (requirements §10) is current:** the app is now a **hosted
Next.js server app** with real server-side auth + cross-device sync — it is
NOT a static export anymore.

> **NEW AGENT / SESSION HANDOFF — START HERE:** read the latest timestamped
> checkpoint in the Obsidian vault at **`Momentus/checkpoints/`** (newest file).
> It summarises what was last done, deployment state, open verification, and
> prioritised next steps, and links the requirements/design/tasks docs. Other
> vault subfolders: `Momentus/requirements/`, `Momentus/design/`,
> `Momentus/tasks/`, `Momentus/progress/` (per-PR notes). UI mockups are in this
> repo at `.kiro/ui_samples/`; PO review notes (git-ignored) in `.kiro/reviews/`.

- **Frontend:** Next.js (App Router, TypeScript) PWA, deployed as a **hosted
  server app** on Vercel (serverless functions + API routes + middleware).
  (Previously static export; dropped in Amendment 2 to support NextAuth + sync.)
- **Runtime wrapper (later):** Capacitor, iOS only, **min target iOS 26.7.1**,
  via the hosted-app model.
- **Auth:** **NextAuth (Auth.js v5)**, Credentials + JWT, bcrypt, Prisma +
  Vercel Postgres (Supabase). Single seeded user, forced first-login change,
  no signup. Split config (`auth.config.ts` edge / `auth.ts` node) keeps the
  Edge middleware under 1 MB.
- **Storage & sync:** local-first IndexedDB cache (`lib/db`) **+ cross-device
  sync** (`lib/sync`) to Vercel Postgres (entry metadata) and **Vercel Blob**
  (binaries — pointers in the DB, NEVER bytes). Last-write-wins + tombstones.
- **On-device AI:** embeddings for search (`transformers.js`, wasm); Apple
  Foundation Models for summarisation (native plugin); extractive fallback.
- **Offline:** once signed in (valid session), the app works offline; only the
  first login / re-auth needs connectivity.

## 2. Package management

- **pnpm only.** Pinned via `package.json` → `"packageManager": "pnpm@12.16.1"`.
  Do not use npm or yarn; do not change the pinned version without agreement.
- Install with a frozen lockfile in CI: `pnpm install --frozen-lockfile`.
- Commit `pnpm-lock.yaml`. Never commit `node_modules/`.
- Add dependencies with pinned/exact versions; avoid wide ranges. Vet new
  packages (popularity, maintenance, typosquatting) before adding.
- Prisma: schema in `prisma/schema.prisma`; `build` runs `prisma generate`.
  Migrations via `pnpm db:migrate:dev` (local) / `pnpm db:migrate` (deploy).
  Secrets (`AUTH_SECRET`, DB URLs, `BLOB_READ_WRITE_TOKEN`) are env vars only.

## 3. Development workflow — TDD

**This project is built test-first. Follow red → green → refactor.**

1. **Red:** write a failing test that expresses the desired behaviour.
2. **Green:** write the minimum code to make it pass.
3. **Refactor:** clean up with tests green.

- Test runner: **Vitest** (+ React Testing Library for components).
- Co-locate unit tests as `*.test.ts(x)` next to the code, or under `__tests__/`.
- Every new feature/fix starts with a test. Do not add production code without a
  failing test that demands it (except pure scaffolding/config).
- Keep tests fast and deterministic; no network, no real device APIs — mock
  `MediaRecorder`, Geolocation, storage, and AI model loads.

## 4. Scripts (pnpm)

| Script               | Purpose                                                      |
| -------------------- | ------------------------------------------------------------ |
| `pnpm dev`           | Next.js dev server                                           |
| `pnpm dev:https`     | `next dev --experimental-https` (PWA/service-worker testing) |
| `pnpm build`         | Production build (`next build`, runs `prisma generate`)      |
| `pnpm start`         | Serve a production build (where applicable)                  |
| `pnpm typecheck`     | `tsc --noEmit`                                               |
| `pnpm lint`          | ESLint                                                       |
| `pnpm format`        | Prettier write                                               |
| `pnpm test`          | Vitest run (CI mode, single pass)                            |
| `pnpm test:watch`    | Vitest watch (local TDD loop)                                |
| `pnpm test:coverage` | Vitest with coverage                                         |

## 5. Local CI & pre-commit hooks

- **Pre-commit (Husky + lint-staged):** on staged files, run ESLint + Prettier,
  and a **secret scan** (gitleaks) over the staged diff. Commits that fail lint,
  format, or the secret scan are rejected.
- **Pre-push:** run `pnpm typecheck` and `pnpm test` before a push reaches the
  remote (fast feedback mirroring CI).
- **GitHub Actions (`.github/workflows/ci.yml`):** on PRs and pushes to feature
  branches — install (frozen lockfile) → typecheck → lint → test → build. A
  separate gitleaks job scans the repo. The iOS/Capacitor native build is a
  separate, later workflow (needs a macOS runner + signing secrets) and is NOT
  on the day-one critical path.
- Do **not** bypass hooks (`--no-verify`) unless explicitly authorised.

## 6. Git hygiene

- **`main` is protected.** Never commit or push directly to `main`.
- Branch per feature/fix:
  - `feat/<slug>` new feature
  - `fix/<slug>` bug fix
  - `chore/<slug>` tooling/infra
  - `docs/<slug>` docs
- Conventional Commits for messages: `feat:`, `fix:`, `chore:`, `test:`,
  `docs:`, `refactor:`.
- Open a PR into `main`; keep PRs small and focused. CI must be green to merge.
- Remote: `https://github.com/fujishimak/momentus.git`.
- Stage specific files, not `git add -A`. Flag any file that may contain secrets
  before committing. Do not modify git config.

## 7. PWA + Capacitor conventions

- Follow Next.js PWA guidance: `app/manifest.ts`, HTTPS, offline via **Serwist**
  service worker. Security headers (`X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy`, SW `Cache-Control`/CSP) are set in **`next.config.ts`**
  (the app is a hosted server app, so it emits its own headers).
- **Server-app conventions (Amendment 2):**
  - Hosted Next.js (`next build`, Vercel serverless); API route handlers under
    `app/api/*`; auth gating via `middleware.ts` + the split NextAuth config.
  - API routes enforce auth in-handler via `await auth()` and return **401 JSON**
    (middleware lets `/api/*` through rather than redirecting).
  - Keep device access + storage behind abstractions (`lib/capture`, `lib/db`,
    `lib/sync`, `lib/ai`) so the browser and future Capacitor paths can diverge
    without touching UI code.
  - **Binaries (audio/photo) go to Vercel Blob; the DB stores pointers only —
    never bytes.** Sync is local-first (IndexedDB queue) → push/pull with
    last-write-wins + tombstones.
- Request device permissions (mic, camera, location) on first use, never at
  launch; always degrade gracefully.

## 8. Quality bar before you call something done

- A failing test existed first, now passes.
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build` all pass locally.
- No secrets added; `.env*` is git-ignored (`.env.example` documents variables).
- Change is on a feature branch with a Conventional Commit and a focused diff.
