<div align="center">

# Forge

**Self-hosted build platform for iOS and Android.**

Build, sign, and submit mobile apps from your own infrastructure. EAS-compatible, multi-tenant, open source.

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/Node-20%2B-339933.svg?logo=node.js&logoColor=white)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![pnpm](https://img.shields.io/badge/pnpm-workspaces-F69220.svg?logo=pnpm&logoColor=white)](https://pnpm.io)

</div>

---

Forge is a production-grade build platform for mobile apps. It runs on a single Mac to start and scales horizontally across a fleet of workers. Teams get isolated orgs, signed artifacts, and one-command submission to the App Store and Google Play — without handing credentials to a third-party SaaS.

## Features

- **iOS builds** run natively on macOS via Xcode.
- **Android builds** run in isolated Docker containers with `--network=none`.
- **Multi-tenant** — organizations, roles, invites, and per-org plan limits.
- **Row-level security** enforced at the database (Supabase Postgres).
- **Encrypted credentials** — AES-256-GCM at rest, decrypted to ephemeral temp files at build time.
- **Real-time logs** streamed over Server-Sent Events.
- **Automatic store submission** to TestFlight, App Store, and Google Play tracks.
- **Optional Stripe billing** with usage metering.
- **Zero open ports** via Cloudflare Tunnel.
- **EAS-compatible `eas.json`** — drop-in for projects already using Expo Application Services.

## Table of Contents

- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [CLI](#cli)
- [REST API](#rest-api)
- [Plan Tiers](#plan-tiers)
- [Cloudflare Tunnel](#cloudflare-tunnel)
- [Android Docker Builder](#android-docker-builder)
- [Security](#security)
- [Scaling](#scaling)
- [Contributing](#contributing)
- [License](#license)

## Architecture

```
CLI · REST API · Dashboard
        │
  Cloudflare Tunnel (zero open ports)
        │
  Fastify API Server (:3000)
  ├── Auth (Supabase JWT + API keys)
  ├── Tenant middleware (org resolution, plan limits)
  ├── Build / Submit / Credential routes
  └── SSE log streaming
        │
  BullMQ + Redis
  ├── builds:ios
  ├── builds:android
  ├── submissions
  └── webhooks
        │
  ┌─────┴──────┐
  iOS Worker   Android Worker
  (Xcode)      (Docker)
  .ipa         .apk / .aab
        │
  Supabase
  ├── Postgres (data + RLS)
  ├── Auth (JWT, magic link, OAuth)
  ├── Storage (build artifacts)
  └── Realtime (live logs)
```

## Tech Stack

| Component | Technology |
| --- | --- |
| API | Node.js, Fastify, TypeScript |
| Queue | BullMQ + Redis |
| Database | Supabase Postgres (RLS enforced) |
| Auth | Supabase Auth (JWT, magic link, OAuth) |
| Storage | Supabase Storage (per-org, signed URLs) |
| iOS builds | Xcode (native on macOS) |
| Android builds | Docker (Linux containers) |
| CLI | Commander.js |
| Dashboard | Next.js 14, Tailwind CSS |
| Ingress | Cloudflare Tunnel |
| Billing | Stripe (subscriptions + usage metering) |
| Monorepo | pnpm workspaces + Turborepo |

## Project Structure

```
forge/
├── packages/
│   ├── api/            Fastify API server
│   ├── worker/         iOS + Android build and submit workers
│   ├── cli/            forge CLI (npm-publishable)
│   └── shared/         Types, Zod schemas, crypto, plan constants
├── apps/
│   └── dashboard/      Next.js user and admin dashboard
├── supabase/
│   └── migrations/     Full SQL schema with RLS policies
├── docker/
│   └── android-builder/  Android SDK Docker image
└── scripts/
    ├── setup.sh        One-command Mac setup
    ├── dev.sh          Start all services locally
    └── rotate-key.sh   Credential encryption key rotation
```

## Prerequisites

- **macOS** (Apple Silicon or Intel)
- **Xcode** — install from the Mac App Store (required for iOS builds)
- **Docker Desktop** — [download](https://www.docker.com/products/docker-desktop/) (required for Android builds)
- A free **Supabase** project — [supabase.com](https://supabase.com)

The setup script installs everything else.

## Quick Start

### 1. Clone and run setup

```bash
git clone https://github.com/Lange-Logic-LLC/forge.git
cd forge
bash scripts/setup.sh
```

The setup script installs Homebrew (if missing), Node.js, pnpm, Redis, `cloudflared`, and the Supabase CLI; installs project dependencies; and generates `.env` files with a fresh AES-256 encryption key.

### 2. Create a Supabase project

1. Create a new project at [supabase.com](https://supabase.com) (the free tier is sufficient for development).
2. In the **SQL Editor**, run `supabase/migrations/00001_initial_schema.sql`.
3. Under **Settings → API**, copy your project URL, anon key, and service role key.
4. Create a **Storage bucket** named `build-artifacts` and set it to private.

### 3. Configure environment

Fill in your Supabase credentials:

| File | Required Keys |
| --- | --- |
| `packages/api/.env` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| `packages/worker/.env` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| `apps/dashboard/.env.local` | `SUPABASE_URL`, `SUPABASE_ANON_KEY` |

Stripe and email (Resend) settings are optional — Forge runs without them.

### 4. Start the platform

```bash
bash scripts/dev.sh              # API + worker + dashboard

# Or run services individually:
pnpm dev:api                     # http://localhost:3000
pnpm dev:worker
pnpm dev:dashboard               # http://localhost:3001
```

### 5. Promote yourself to admin

Sign up through the dashboard at `http://localhost:3001`, then run the following in the Supabase SQL editor:

```sql
update profiles set is_admin = true where email = 'your@email.com';
```

## CLI

### Install

```bash
# From the monorepo (development)
pnpm --filter @forge/cli dev -- <command>

# Or build and link globally
pnpm build:cli
cd packages/cli && npm link
forge <command>
```

### Authentication

```bash
forge login                                    # Enter API token from dashboard
forge login --api-url https://api.example.com
forge whoami                                   # Show user, org, plan, usage
forge logout
```

### Organizations

```bash
forge org:create                               # Interactive — name + slug
forge org:switch <slug>                        # Set active org
forge org:switch                               # List all orgs
forge org:members                              # List members + roles
forge org:invite user@example.com              # Invite member
forge org:invite user@example.com --role admin
```

### Builds

```bash
forge build --platform ios                     # Build iOS
forge build --platform android                 # Build Android
forge build --platform all                     # Build both
forge build --profile preview                  # Use a specific eas.json profile
forge build --no-wait                          # Queue and exit without streaming
forge build --auto-submit                      # Submit to store after build
forge build --auto-submit --track testflight-internal

forge build:list
forge build:list --platform ios --status failed
forge build:view <build-id>
forge build:download <build-id>
forge build:cancel <build-id>
```

### Submissions

```bash
forge submit --platform ios --latest
forge submit --platform ios --build-id <id>
forge submit --platform ios --track testflight-internal
forge submit --platform ios --track app-store
forge submit --platform android --track internal
forge submit --platform android --track production

forge submit:list
forge submit:view <submission-id>
```

### Credentials

```bash
forge credentials add                          # Interactive wizard
forge credentials add --type ios-distribution
forge credentials add --type ios-asc-api-key
forge credentials add --type android-keystore
forge credentials add --type android-service-account
forge credentials list
forge credentials remove <id>
```

Supported credential types:

| Type | Description |
| --- | --- |
| `ios-distribution` | `.p12` certificate + `.mobileprovision` |
| `ios-asc-api-key` | App Store Connect API key (`.p8`) — required for submissions |
| `ios-apns` | Push notification key (`.p8`) |
| `android-keystore` | Upload keystore (`.jks`) |
| `android-service-account` | Google Play service account (`.json`) — required for submissions |

### `eas.json`

Forge reads `eas.json` from your project root, matching the EAS schema:

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal"
    },
    "release": {
      "ios": { "credentialId": "<uuid>" },
      "android": { "credentialId": "<uuid>" }
    }
  },
  "submit": {
    "release": {
      "ios": {
        "ascApiKeyCredentialId": "<uuid>",
        "ascAppId": "1234567890",
        "track": "testflight-internal"
      },
      "android": {
        "serviceAccountCredentialId": "<uuid>",
        "androidPackage": "com.company.app",
        "track": "internal"
      }
    }
  }
}
```

## REST API

All endpoints require `Authorization: Bearer <token>` (Supabase JWT or Forge API key).

### Auth

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/auth/token` | Create an API key |
| `GET` | `/auth/tokens` | List your API keys |
| `DELETE` | `/auth/tokens/:id` | Revoke an API key |

### Organizations

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/orgs` | Create organization |
| `GET` | `/orgs` | List your organizations |
| `GET` | `/orgs/:slug` | Get organization details |
| `PATCH` | `/orgs/:slug` | Update organization (owner only) |
| `GET` | `/orgs/:slug/members` | List members |
| `POST` | `/orgs/:slug/invites` | Invite user |
| `DELETE` | `/orgs/:slug/members/:userId` | Remove member |

### Builds

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/orgs/:slug/builds` | Start a build |
| `GET` | `/orgs/:slug/builds` | List builds (paginated) |
| `GET` | `/orgs/:slug/builds/:id` | Get build details |
| `DELETE` | `/orgs/:slug/builds/:id` | Cancel build |
| `GET` | `/orgs/:slug/builds/:id/logs` | Stream logs (SSE) |

### Submissions

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/orgs/:slug/submissions` | Submit build to store |
| `GET` | `/orgs/:slug/submissions` | List submissions |
| `GET` | `/orgs/:slug/submissions/:id` | Get submission details |
| `DELETE` | `/orgs/:slug/submissions/:id` | Cancel submission |

### Credentials

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/orgs/:slug/credentials` | Upload credential |
| `GET` | `/orgs/:slug/credentials` | List credentials |
| `DELETE` | `/orgs/:slug/credentials/:id` | Delete credential |

### Webhooks

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/orgs/:slug/webhooks` | Register webhook |
| `GET` | `/orgs/:slug/webhooks` | List webhooks |
| `DELETE` | `/orgs/:slug/webhooks/:id` | Delete webhook |

### Admin (requires `is_admin = true`)

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/admin/orgs` | All organizations |
| `GET` | `/admin/builds` | All builds |
| `GET` | `/admin/workers` | Worker pool status |
| `PATCH` | `/admin/orgs/:slug/plan` | Override an organization's plan |

## Plan Tiers

Plan enforcement is built in. Default tiers are defined in `packages/shared/src/plans.ts` and can be customized by operators:

| Plan | Builds / month | Concurrent | Artifact TTL |
| --- | --- | --- | --- |
| Starter | 25 | 1 | 7 days |
| Pro | 200 | 3 | 30 days |
| Team | 1,000 | 10 | 90 days |
| Enterprise | Unlimited | Custom | Custom |

Stripe integration is optional. Without Stripe configured, all orgs default to the Starter tier and no billing is enforced.

## Cloudflare Tunnel

Expose your instance publicly without opening any ports:

```bash
cloudflared tunnel login
cloudflared tunnel create forge
cloudflared tunnel route dns forge api.yourdomain.com
cloudflared tunnel route dns forge app.yourdomain.com
```

Copy `scripts/cloudflare-config.example.yml` to `~/.cloudflared/config.yml`, set your tunnel ID, and run:

```bash
cloudflared tunnel run forge

# Or install as a persistent service:
sudo cloudflared service install
```

## Android Docker Builder

The Android worker executes Gradle inside a Docker container with `--network=none` for build isolation.

```bash
docker build -t forge/android-builder:latest docker/android-builder/
```

The setup script builds the image automatically when Docker is running.

## Security

- Signing credentials are encrypted with **AES-256-GCM** at rest.
- Credentials are decrypted to ephemeral temp files at build time and wiped in `finally` blocks.
- Android builds run in Docker with `--network=none` (no internet access).
- Supabase **Row Level Security** enforces tenant isolation at the database layer.
- API keys are **bcrypt-hashed** before storage.
- Cloudflare Tunnel means no ports are open on the host.
- Webhook payloads are signed with **HMAC-SHA256**.

Rotate the encryption key periodically:

```bash
bash scripts/rotate-key.sh
```

Security issues should be reported privately to the maintainers rather than filed as public GitHub issues.

## Scaling

Forge is designed to grow with you:

1. **Add more Mac workers** for iOS — point them at the same Redis and Supabase.
2. **Add Linux VPS nodes** for Android — the worker code deploys unchanged, only the `.env` differs.
3. **Move Redis** to a managed instance (Upstash, Railway, or self-hosted).
4. **Upgrade Supabase** to Pro for production workloads.

No application code changes are required to scale — only `REDIS_URL` and `SUPABASE_URL` in the worker `.env`.

## Contributing

Contributions are welcome. Please:

1. Open an issue to discuss substantial changes before starting work.
2. Follow the existing code style (TypeScript strict mode, Prettier defaults).
3. Include tests for new behavior where practical.
4. By submitting a pull request, you agree to license your contribution under the [Apache License 2.0](LICENSE).

## License

Licensed under the [Apache License, Version 2.0](LICENSE).

```
Copyright 2026 Lange Logic LLC

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0
```
