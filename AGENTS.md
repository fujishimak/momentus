# AGENTS.md — Momentus

Operating guide for any agent or developer working in this repository. Read this
before making changes. It encodes the tooling, workflow, and quality gates this
project commits to.

## 1. What this project is

Momentus is a daily micro-journal PWA for aspiring speakers and
improvisers: capture a brief statement about your day (audio ≤60s or text ≤150
words), optionally one photo, with timestamp + location metadata. Entries are
captured **local-first** (usable offline), **sync across the signed-in user's
devices**, and are searchable/summarisable via on-device AI.

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
- **Build-scripts gotcha (`pnpm-workspace.yaml`):** pnpm@12 blocks dependency
  build scripts by default and, on a clean (CI) install with no local approval
  state, will **exit non-zero** on ignored builds. The committed settings make
  `pnpm install --frozen-lockfile` pass deterministically:
  `onlyBuiltDependencies` allow-lists what must build (esbuild, @prisma/client,
  prisma); `ignoredBuiltDependencies` suppresses the rest (onnxruntime-node,
  protobufjs, sharp — we use the wasm/unoptimized paths); `strictDepBuilds:
false` stops the install from failing over anything outside the allow-list.
  If you add a dep with a postinstall, decide which list it belongs in.

## 3. Development workflow — TDD

**This project is built test-first. Follow red → green → refactor.**

1. **Red:** write a failing test that expresses the desired behaviour.
2. **Green:** write the minimum code to make it pass.
3. **Refactor:** clean up with tests green.

- Test runner: **Vitest** (+ React Testing Library for components).
- Co-locate unit tests as `*.test.ts(x)` next to the code, or under `__tests__/`.
- Every new feature/fix starts with a test. Do not add production code without a
  failing test that demands it (except pure scaffolding/config).
- Keep tests fast and deterministic; no network, no real device APIs, no real
  DB. Mock/inject: `MediaRecorder`, Geolocation, storage, AI model loads, the
  sync `SyncServer` (use the in-memory fake), and Prisma (use a mock or the
  `authorizeCredentials`/sync-core pure functions). The real Postgres/Blob and
  on-device model are verified in staging/on-device, never in CI.

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

## 5. CI / CD & hooks

**Local hooks (Husky):**

- **Pre-commit (lint-staged):** ESLint + Prettier on staged files, plus a
  **gitleaks** secret scan over the staged diff. Fails the commit on lint,
  format, or secret issues.
- **Pre-push:** `pnpm typecheck` + `pnpm test` (mirrors CI for fast feedback).
- Do **not** bypass hooks (`--no-verify`) unless explicitly authorised.

**GitHub Actions — `.github/workflows/ci.yml`** (PRs + pushes to non-main
branches), two required jobs:

- `typecheck · lint · test · build` → install (`--frozen-lockfile`) → typecheck
  → lint → test → **build** (`next build`, runs `prisma generate`).
- `gitleaks secret scan` — repo scan.
- **Gotcha:** `gitleaks-action@v2` needs `GITHUB_TOKEN` in `env` to scan
  `pull_request` events (without it, PR scans fail while push scans pass). It's
  already wired; keep it.

**Branch protection on `main` (enforced on GitHub, not just convention):**

- PRs required; direct pushes blocked.
- Both status checks above must pass, **strict/up-to-date** before merge.
- Required approvals = 0 on GitHub (the PO review in §5a is the human/process
  gate; CI is the technical gate). So merges are: PO-approved + CI-green.

### 5a. Per-PR review workflow (how every change merges)

Every PR goes through a **Product Owner single-pass review** before merge:

1. Open the PR (feature branch → `main`).
2. Dispatch a PO review (sub-agent): it reads the diff against the committed
   scope, verifies CI is actually green (`gh pr checks <n>`, not local-only),
   and returns a verdict + blockers + slipstream items. Notes go to
   `.kiro/reviews/` (git-ignored).
3. **APPROVE / APPROVE WITH NITS → merge** (squash, delete branch). Nits and
   downstream items are slipstreamed into the task graph / the latest
   `Momentus/checkpoints/` note — not fixed inline.
4. **REQUEST CHANGES → fix on the same branch, push, let the PO re-check the
   blocker, then merge.** Do not start dependent work while a PR is awaiting a
   feedback-driven update or is blocked on an unperformed merge.

### 5b. Deployment (CD) — Vercel

- **Target:** Vercel project `momentus` (team `joshs-projects-05563e32`),
  framework Next.js. Config in `vercel.json` (framework + build/install
  commands); security headers live in `next.config.ts`.
- **Preview:** `pnpm exec vercel deploy --yes` → throwaway preview URL. Verify
  it before promoting. (SSO/Deployment Protection is currently disabled so
  previews are shareable — re-enable if that changes.)
- **Production:** `pnpm exec vercel --prod` — only after PO approval + a human
  sign-off on the preview. Follow with a prod smoke check (`/`, `/login`,
  `/api/entries` → 401 JSON, security headers).
- **Env/secrets** live on Vercel (Preview + Production) and locally in
  `.env.local` (git-ignored, `vercel env pull`): `AUTH_SECRET`,
  `MOMENTUS_DB_POSTGRES_PRISMA_URL` (pooled/runtime),
  `MOMENTUS_DB_POSTGRES_URL_NON_POOLING` (direct/migrations),
  `BLOB_READ_WRITE_TOKEN`. **Never commit secrets.** Provisioning
  (Vercel Postgres/Supabase, Vercel Blob) is a user hand-off.
- **Known blockers seen before:** Vercel refuses deploys on a vulnerable Next.js
  version (keep Next patched); the NextAuth middleware must use the **edge-safe
  split config** or it exceeds the 1 MB Edge Function limit.

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
- PR opened into `main`; **PO review passed** (§5a) and **CI green** (§5) before
  merge; branch deleted after squash-merge.
- Progress/decisions captured in a dated `Momentus/progress/` note or the
  latest `Momentus/checkpoints/` file (don't rewrite large docs in place).
