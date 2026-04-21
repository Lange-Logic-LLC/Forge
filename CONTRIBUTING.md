# Contributing to Forge

Thanks for your interest in contributing to Forge! This document covers how to report bugs, propose features, set up the development environment, and submit changes.

By participating in this project, you agree to abide by the [Code of Conduct](CODE_OF_CONDUCT.md).

## Table of Contents

- [Ways to Contribute](#ways-to-contribute)
- [Development Setup](#development-setup)
- [Project Layout](#project-layout)
- [Making Changes](#making-changes)
- [Commit Messages](#commit-messages)
- [Testing](#testing)
- [Submitting a Pull Request](#submitting-a-pull-request)
- [Reporting Security Issues](#reporting-security-issues)
- [Licensing of Contributions](#licensing-of-contributions)

## Ways to Contribute

- **Report bugs** — open an issue using the Bug Report template.
- **Request features** — open an issue using the Feature Request template, or start a thread in [Discussions](https://github.com/Lange-Logic-LLC/Forge/discussions).
- **Improve documentation** — typo fixes, clarifications, and new examples are always welcome.
- **Fix a bug or implement a feature** — see open issues tagged `good first issue` or `help wanted`.
- **Share the project** — stars, blog posts, and word of mouth help Forge reach more operators.

> [!TIP]
> For substantial changes (new subsystems, breaking API changes, new dependencies), please open an issue first to discuss the approach. This saves you from writing code that may not be merged.

## Development Setup

### Prerequisites

- **macOS** (Apple Silicon or Intel) — required for iOS build testing
- **Node.js 20+** and **pnpm** — install pnpm via `npm install -g pnpm` or Homebrew
- **Docker Desktop** — required for Android build testing
- **Redis** — `brew install redis && brew services start redis`
- A **Supabase project** — the free tier is sufficient. See the README for setup steps.

### First-Time Setup

```bash
git clone https://github.com/Lange-Logic-LLC/Forge.git
cd Forge
bash scripts/setup.sh
```

The setup script installs all dependencies and generates fresh `.env` files with an AES-256 encryption key.

### Running Locally

```bash
bash scripts/dev.sh              # Starts API + worker + dashboard

# Or individually:
pnpm dev:api                     # http://localhost:3000
pnpm dev:worker
pnpm dev:dashboard               # http://localhost:3001
```

### What You Can Develop Without a Mac

The API, dashboard, CLI, and shared packages can be developed and tested on any platform. Only the **iOS build worker** requires macOS + Xcode. If you are on Linux or Windows and want to contribute to the iOS worker, you can still review code and write unit tests — just flag in your PR that you were unable to run an end-to-end iOS build.

## Project Layout

```
forge/
├── packages/
│   ├── api/        Fastify API server — routes, plugins, queue producers
│   ├── worker/     Build + submit workers (iOS via Xcode, Android via Docker)
│   ├── cli/        `forge` CLI binary
│   └── shared/     Types, Zod schemas, crypto utilities, plan constants
├── apps/
│   └── dashboard/  Next.js 14 user and admin dashboard
├── supabase/
│   └── migrations/ Postgres schema + RLS policies
├── docker/
│   └── android-builder/  Docker image used by the Android worker
└── scripts/        Setup, dev, and key-rotation shell scripts
```

When adding new functionality:

- **Types and schemas** belong in `packages/shared` so they can be imported by every workspace.
- **Route handlers** go in `packages/api/src/routes`.
- **Background work** is queued by API routes and executed in `packages/worker`.
- **Dashboard pages** live in `apps/dashboard/app` and consume the REST API.
- **CLI commands** live in `packages/cli/src/commands`.

## Making Changes

### Branching

Branch from `main`:

```bash
git checkout -b feat/your-feature-name
# or
git checkout -b fix/short-bug-description
```

Suggested prefixes: `feat/`, `fix/`, `docs/`, `refactor/`, `test/`, `chore/`.

### Code Style

- **TypeScript strict mode** is enabled across the monorepo — please keep it that way.
- **Prettier defaults** (no trailing commas, single quotes, 2-space indent) — most editors pick this up automatically.
- **Named exports** over default exports, except for Next.js page/layout files where defaults are required.
- **No `any`** without a comment justifying why it's unavoidable.
- **No console.log** in committed code — use Fastify's logger in the API, or a dedicated logger in workers.

### Before You Commit

```bash
pnpm typecheck    # TypeScript across the whole monorepo
pnpm lint         # If/when a lint script is added
pnpm test         # Unit tests (where present)
pnpm build        # Ensure everything still compiles
```

Each of these should pass locally before you open a PR.

## Commit Messages

Short, specific, present-tense. Lead with what changed; skip unnecessary context that belongs in the PR description.

Good:

```
Add webhook retry backoff
Fix credential decryption leak in finally block
Update Supabase client to v2.40
```

Avoid:

```
fixed stuff
WIP
updates
```

You don't need to follow a rigid convention like Conventional Commits, but consistency helps. One logical change per commit where reasonable. Squash if your branch has noisy in-progress commits.

## Testing

Testing coverage is currently light — contributions that add tests for existing behavior are especially welcome.

- **Unit tests** live alongside source files (`foo.test.ts` next to `foo.ts`) where they exist.
- **Integration tests** that hit Supabase or Redis should be gated behind an env var check so CI can run them selectively.
- **Manual testing** is expected for anything that touches the build pipeline — run an iOS and/or Android build end-to-end and confirm the artifact is produced.

If your PR changes the build pipeline, please note in the description which platforms you tested against.

## Submitting a Pull Request

1. Push your branch to your fork (or directly to the repo if you have write access).
2. Open a PR against `main`.
3. Fill in the PR template — especially the "What changed" and "How to test" sections.
4. Link the issue your PR resolves (if any) with `Closes #123`.
5. Keep the PR focused — one concern per PR. Multiple unrelated changes in one PR are harder to review and more likely to hit merge conflicts.
6. Respond to review feedback by pushing additional commits to the branch. A maintainer will squash on merge.

Maintainers aim to provide a first response within 5 business days. Complex changes may take longer to review.

## Reporting Security Issues

**Do not open a public issue for security vulnerabilities.** See [`SECURITY.md`](SECURITY.md) for the responsible-disclosure process.

## Licensing of Contributions

Forge is licensed under the [Apache License 2.0](LICENSE). By submitting a pull request, you agree that your contribution is licensed under the same terms.

You retain copyright over your contributions. Apache 2.0's contributor grant (Section 5) applies: you grant Lange Logic LLC and all downstream users a perpetual, worldwide, royalty-free license to use, modify, and redistribute your contribution as part of Forge.

If your employer has rights to your work, please confirm with them before contributing.

---

Thanks again for contributing. If you have questions that aren't answered here, open a [Discussion](https://github.com/Lange-Logic-LLC/Forge/discussions) — we're happy to help.
