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

- **Frontend:** Next.js (App Router, TypeScript) as a PWA, **static export**
  (`output: 'export'`) so the same build can be wrapped by Capacitor.
- **Runtime wrapper (later):** Capacitor, iOS only, **min target iOS 26.7.1**.
- **Local storage:** data-access layer over IndexedDB (browser) / Capacitor
  SQLite (native).
- **On-device AI:** embeddings for search (`transformers.js`, wasm); Apple
  Foundation Models for summarisation (native plugin); extractive fallback.
- **No backend data / no auth / no cloud sync for the MVP.** Local-first.

## 2. Package management

- **pnpm only.** Pinned via `package.json` → `"packageManager": "pnpm@12.16.1"`.
  Do not use npm or yarn; do not change the pinned version without agreement.
- Install with a frozen lockfile in CI: `pnpm install --frozen-lockfile`.
- Commit `pnpm-lock.yaml`. Never commit `node_modules/`.
- Add dependencies with pinned/exact versions; avoid wide ranges. Vet new
  packages (popularity, maintenance, typosquatting) before adding.

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
| `pnpm build`         | Production static export (`out/`)                            |
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
  `Referrer-Policy`, SW `Cache-Control`/CSP) are set at the host/proxy (Vercel)
  because static export cannot emit headers from `next.config`.
- **Static-export discipline (so Capacitor works later):**
  - `output: 'export'`; `images.unoptimized: true`.
  - No Server Actions, no route handlers depended on at runtime, no server-only
    data fetching for app behaviour. The app must run from static files in a
    `file://`/webview context.
  - Use relative asset paths; avoid hard-coded origins.
  - Keep all device access behind an abstraction (`lib/capture`, `lib/db`,
    `lib/ai`) so the browser and Capacitor implementations can diverge without
    touching UI code.
- Request device permissions (mic, camera, location) on first use, never at
  launch; always degrade gracefully.

## 8. Quality bar before you call something done

- A failing test existed first, now passes.
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build` all pass locally.
- No secrets added; `.env*` is git-ignored (`.env.example` documents variables).
- Change is on a feature branch with a Conventional Commit and a focused diff.
