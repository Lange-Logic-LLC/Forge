# Changelog

All notable changes to Forge are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Continuous integration workflow (`.github/workflows/ci.yml`) running install + build on every push and pull request to `main`.
- Root and workspace `package.json` metadata: `license` (Apache-2.0), `author` (Lange Logic LLC), `description`, `repository`, `homepage`, `bugs`.
- Full npm-publish metadata for `@forge/cli` — `keywords`, `files`, `repository.directory`.
- Editor configuration: `.editorconfig` and `.prettierrc` (+ `.prettierignore`).
- `format` and `format:check` npm scripts using Prettier.
- `CHANGELOG.md` (this file).
- Dependabot configuration for weekly dependency updates (`.github/dependabot.yml`).

### Changed

- Removed the stale `lint` script and Turbo task (no linter was configured).

### Fixed

- Worker and API `ioredis` imports switched from default to named (`import { Redis } from 'ioredis'`) to satisfy NodeNext module resolution.
- Stripe API version string pinned to `2023-10-16` to match the installed `stripe@14` SDK.
- Dashboard `supabase-server` cookie parameter typed explicitly (was implicit `any` under strict mode).
- Dashboard auth page now lazily initializes the Supabase client inside the submit handler, allowing prerender without runtime environment variables.
- Added missing `@types/inquirer` devDependency to the CLI package.

## [0.1.0] — 2026-04-20

Initial public release under the Apache License 2.0.

### Added

- iOS build worker using native Xcode on macOS.
- Android build worker using Docker (`--network=none` isolation).
- Multi-tenant organizations with role-based access and per-organization plan limits.
- AES-256-GCM credential encryption with ephemeral decryption at build time.
- REST API built on Fastify + BullMQ + Supabase.
- `@forge/cli` command-line client covering build, submit, credentials, org, and auth commands.
- Next.js 14 dashboard with admin panel.
- Supabase Postgres schema with Row-Level Security policies.
- Real-time build-log streaming over Server-Sent Events.
- Automatic submission to TestFlight, the App Store, and Google Play tracks.
- `eas.json` configuration parser for drop-in compatibility with the common mobile build format.
- Optional Stripe billing integration with subscription and usage metering.
- Cloudflare Tunnel support for public exposure with zero open ports.
- Shared crypto, types, and Zod schemas in the `@forge/shared` workspace package.

### Security

- All signing credentials are encrypted at rest and decrypted only to ephemeral temp files at build time, wiped in `finally` blocks.
- Supabase Row-Level Security policies enforce tenant isolation at the database layer.
- API keys are bcrypt-hashed before storage.
- Webhook payloads are signed with HMAC-SHA256.

[Unreleased]: https://github.com/Lange-Logic-LLC/Forge/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Lange-Logic-LLC/Forge/releases/tag/v0.1.0
