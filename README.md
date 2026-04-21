<div align="center">
  <a href="https://github.com/Lange-Logic-LLC">
    <img src="https://avatars.githubusercontent.com/u/254763336?s=200&v=4" alt="Lange Logic LLC" width="120" height="120" style="border-radius: 24px;" />
  </a>

  <h1>Forge</h1>

  <p><strong>Self-hosted build platform for iOS and Android.</strong></p>
  <p>
    Build, sign, and submit mobile apps from your own infrastructure.<br/>
    Self-hosted. Multi-tenant. Open source.
  </p>

  <p>
    <a href="LICENSE"><img alt="License: Apache 2.0" src="https://img.shields.io/badge/License-Apache%202.0-3178C6.svg?style=flat-square"></a>
    <a href="https://github.com/Lange-Logic-LLC/forge/stargazers"><img alt="GitHub stars" src="https://img.shields.io/github/stars/Lange-Logic-LLC/forge?style=flat-square&color=f59e0b"></a>
    <a href="https://github.com/Lange-Logic-LLC/forge/pulls"><img alt="PRs welcome" src="https://img.shields.io/badge/PRs-welcome-22c55e.svg?style=flat-square"></a>
    <img alt="Node" src="https://img.shields.io/badge/Node-20%2B-339933.svg?style=flat-square&logo=node.js&logoColor=white">
    <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6.svg?style=flat-square&logo=typescript&logoColor=white">
    <img alt="pnpm" src="https://img.shields.io/badge/pnpm-workspaces-F69220.svg?style=flat-square&logo=pnpm&logoColor=white">
  </p>

  <p>
    <a href="#quick-start"><strong>Quick Start</strong></a> ·
    <a href="#features">Features</a> ·
    <a href="#architecture">Architecture</a> ·
    <a href="#cli">CLI</a> ·
    <a href="#rest-api">API</a> ·
    <a href="#comparison">Comparison</a> ·
    <a href="#contributing">Contributing</a>
  </p>

  <br/>
</div>

> [!NOTE]
> Forge is under active development by [Lange Logic LLC](https://github.com/Lange-Logic-LLC). Expect breaking changes before the `1.0` release. Production use is supported, but pin your versions.

## Overview

**Forge** is an open-source build platform you run on your own hardware. A single Mac is enough to get started; add workers horizontally as you scale. Teams get isolated orgs, encrypted credential storage, and one-command submission to the App Store and Google Play — without handing your signing keys to a third-party SaaS.

Forge reads the same `eas.json` build configuration format used by common managed services, so existing mobile projects can adopt it without rewriting their build config.

It ships with a CLI, a REST API, and a web dashboard — built on Fastify, BullMQ, Supabase, and Next.js.

<br/>

## Features

- :iphone: **iOS builds** run natively on macOS via Xcode.
- :robot: **Android builds** run in isolated Docker containers with `--network=none`.
- :busts_in_silhouette: **Multi-tenant** — organizations, role-based access, invites, per-org plan limits.
- :lock: **Row-level security** enforced at the database layer (Supabase Postgres).
- :key: **AES-256-GCM** encrypted credential storage with ephemeral decryption at build time.
- :satellite: **Real-time log streaming** over Server-Sent Events.
- :package: **Automatic submission** to TestFlight, the App Store, and Google Play.
- :credit_card: **Optional Stripe billing** with usage metering.
- :shield: **Zero open ports** via Cloudflare Tunnel.
- :arrows_counterclockwise: **Reads `eas.json`** — uses the common mobile build configuration format, so existing projects can adopt Forge without rewriting their config.
- :earth_americas: **Deploy anywhere** — runs on your laptop, a single Mac Mini, a fleet, or a mixed Mac + Linux pool.

<br/>

## Quick Start

> **Prerequisites:** macOS (Apple Silicon or Intel), Xcode, Docker Desktop, and a free [Supabase](https://supabase.com) project.

```bash
git clone https://github.com/Lange-Logic-LLC/forge.git
cd forge
bash scripts/setup.sh
bash scripts/dev.sh
```

The setup script installs Homebrew, Node.js, pnpm, Redis, `cloudflared`, and the Supabase CLI; installs project dependencies; and generates `.env` files with a fresh AES-256 encryption key. See the [full setup guide](#full-setup) below for Supabase configuration and admin promotion.

<br/>

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

### Tech Stack

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

### Project Structure

```
forge/
├── packages/
│   ├── api/              Fastify API server
│   ├── worker/           iOS + Android build and submit workers
│   ├── cli/              forge CLI (npm-publishable)
│   └── shared/           Types, Zod schemas, crypto, plan constants
├── apps/
│   └── dashboard/        Next.js user and admin dashboard
├── supabase/
│   └── migrations/       Full SQL schema with RLS policies
├── docker/
│   └── android-builder/  Android SDK Docker image
└── scripts/
    ├── setup.sh          One-command Mac setup
    ├── dev.sh            Start all services locally
    └── rotate-key.sh     Credential encryption key rotation
```

<br/>

## Full Setup

### 1. Clone and run setup

```bash
git clone https://github.com/Lange-Logic-LLC/forge.git
cd forge
bash scripts/setup.sh
```

### 2. Create a Supabase project

1. Create a new project at [supabase.com](https://supabase.com) (the free tier is sufficient for development).
2. In the **SQL Editor**, run `supabase/migrations/00001_initial_schema.sql`.
3. Under **Settings → API**, copy your project URL, anon key, and service role key.
4. Create a **Storage bucket** named `build-artifacts` and set it to private.

### 3. Configure environment

Fill in your Supabase credentials:

| File | Required keys |
| --- | --- |
| `packages/api/.env` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| `packages/worker/.env` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| `apps/dashboard/.env.local` | `SUPABASE_URL`, `SUPABASE_ANON_KEY` |

Stripe and Resend are optional — Forge runs without them.

### 4. Start the platform

```bash
bash scripts/dev.sh              # API + worker + dashboard

# Or run services individually:
pnpm dev:api                     # http://localhost:3000
pnpm dev:worker
pnpm dev:dashboard               # http://localhost:3001
```

### 5. Promote yourself to admin

Sign up via the dashboard, then run in the Supabase SQL editor:

```sql
update profiles set is_admin = true where email = 'your@email.com';
```

<br/>

## CLI

<details>
<summary><strong>Install</strong></summary>

```bash
# From the monorepo (development)
pnpm --filter @forge/cli dev -- <command>

# Or build and link globally
pnpm build:cli
cd packages/cli && npm link
forge <command>
```

</details>

<details>
<summary><strong>Authentication</strong></summary>

```bash
forge login                                    # Enter API token from dashboard
forge login --api-url https://api.example.com
forge whoami                                   # Show user, org, plan, usage
forge logout
```

</details>

<details>
<summary><strong>Organizations</strong></summary>

```bash
forge org:create                               # Interactive — name + slug
forge org:switch <slug>                        # Set active org
forge org:switch                               # List all orgs
forge org:members                              # List members + roles
forge org:invite user@example.com              # Invite member
forge org:invite user@example.com --role admin
```

</details>

<details>
<summary><strong>Builds</strong></summary>

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

</details>

<details>
<summary><strong>Submissions</strong></summary>

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

</details>

<details>
<summary><strong>Credentials</strong></summary>

```bash
forge credentials add                          # Interactive wizard
forge credentials add --type ios-distribution
forge credentials add --type ios-asc-api-key
forge credentials add --type android-keystore
forge credentials add --type android-service-account
forge credentials list
forge credentials remove <id>
```

| Type | Description |
| --- | --- |
| `ios-distribution` | `.p12` certificate + `.mobileprovision` |
| `ios-asc-api-key` | App Store Connect API key (`.p8`) — required for iOS submissions |
| `ios-apns` | Push notification key (`.p8`) |
| `android-keystore` | Upload keystore (`.jks`) |
| `android-service-account` | Google Play service account (`.json`) — required for Android submissions |

</details>

<details>
<summary><strong><code>eas.json</code> schema</strong></summary>

Forge reads `eas.json` from your project root, using the same configuration schema as other mobile build services:

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

</details>

<br/>

## REST API

All endpoints require `Authorization: Bearer <token>` (Supabase JWT or Forge API key).

<details>
<summary><strong>Auth</strong></summary>

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/auth/token` | Create an API key |
| `GET` | `/auth/tokens` | List your API keys |
| `DELETE` | `/auth/tokens/:id` | Revoke an API key |

</details>

<details>
<summary><strong>Organizations</strong></summary>

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/orgs` | Create organization |
| `GET` | `/orgs` | List your organizations |
| `GET` | `/orgs/:slug` | Get organization details |
| `PATCH` | `/orgs/:slug` | Update organization (owner only) |
| `GET` | `/orgs/:slug/members` | List members |
| `POST` | `/orgs/:slug/invites` | Invite user |
| `DELETE` | `/orgs/:slug/members/:userId` | Remove member |

</details>

<details>
<summary><strong>Builds</strong></summary>

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/orgs/:slug/builds` | Start a build |
| `GET` | `/orgs/:slug/builds` | List builds (paginated) |
| `GET` | `/orgs/:slug/builds/:id` | Get build details |
| `DELETE` | `/orgs/:slug/builds/:id` | Cancel build |
| `GET` | `/orgs/:slug/builds/:id/logs` | Stream logs (SSE) |

</details>

<details>
<summary><strong>Submissions</strong></summary>

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/orgs/:slug/submissions` | Submit build to store |
| `GET` | `/orgs/:slug/submissions` | List submissions |
| `GET` | `/orgs/:slug/submissions/:id` | Get submission details |
| `DELETE` | `/orgs/:slug/submissions/:id` | Cancel submission |

</details>

<details>
<summary><strong>Credentials</strong></summary>

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/orgs/:slug/credentials` | Upload credential |
| `GET` | `/orgs/:slug/credentials` | List credentials |
| `DELETE` | `/orgs/:slug/credentials/:id` | Delete credential |

</details>

<details>
<summary><strong>Webhooks</strong></summary>

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/orgs/:slug/webhooks` | Register webhook |
| `GET` | `/orgs/:slug/webhooks` | List webhooks |
| `DELETE` | `/orgs/:slug/webhooks/:id` | Delete webhook |

</details>

<details>
<summary><strong>Admin</strong> (requires <code>is_admin = true</code>)</summary>

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/admin/orgs` | All organizations |
| `GET` | `/admin/builds` | All builds |
| `GET` | `/admin/workers` | Worker pool status |
| `PATCH` | `/admin/orgs/:slug/plan` | Override an organization's plan |

</details>

<br/>

## Comparison

Forge is one of several options for building and submitting mobile apps. It isn't the right fit for every team — the tradeoffs below may help you decide whether self-hosting makes sense for your project.

|  | **Forge** (self-hosted) | Typical managed SaaS |
| --- | --- | --- |
| **License** | Apache 2.0, open source | Proprietary, closed source |
| **Hosting** | Your hardware | Vendor-managed |
| **Pricing** | Infrastructure cost only | Per-build + subscription tiers |
| **Build volume** | Bounded by your hardware | Metered / tiered |
| **iOS runner** | macOS (native Xcode) | Vendor's macOS fleet |
| **Android runner** | Docker on macOS or Linux | Vendor's Linux fleet |
| **Credentials** | AES-256-GCM, encrypted at rest on your infra | Held by the vendor |
| **Multi-tenant orgs** | Yes | Varies by vendor |
| **Configuration** | Reads `eas.json` | Varies by vendor |
| **Data residency** | Your infrastructure | Vendor's infrastructure |
| **Support** | Community + commercial (via Lange Logic) | Vendor's support desk |

See the [Trademarks](#trademarks) section for notes on third-party names referenced in this project.

<br/>

## Plan Tiers

Plan enforcement is built in. The default tiers live in `packages/shared/src/plans.ts` and can be customized by operators:

| Plan | Builds / month | Concurrent | Artifact TTL |
| --- | --- | --- | --- |
| Starter | 25 | 1 | 7 days |
| Pro | 200 | 3 | 30 days |
| Team | 1,000 | 10 | 90 days |
| Enterprise | Unlimited | Custom | Custom |

Stripe integration is optional. Without Stripe configured, all orgs default to the Starter tier with no billing enforcement.

<br/>

## Security

> [!IMPORTANT]
> Report security vulnerabilities privately — see [`SECURITY.md`](SECURITY.md) for the disclosure process. Please do not file public GitHub issues for security problems.

- Signing credentials are encrypted with **AES-256-GCM** at rest.
- Credentials decrypt to ephemeral temp files at build time and are wiped in `finally` blocks.
- Android builds run in Docker with `--network=none` — no outbound internet access.
- Supabase **Row Level Security** enforces tenant isolation at the database layer.
- API keys are **bcrypt-hashed** before storage.
- Cloudflare Tunnel means no ports are open on the host.
- Webhook payloads are signed with **HMAC-SHA256**.

Rotate the encryption key periodically:

```bash
bash scripts/rotate-key.sh
```

<br/>

## Cloudflare Tunnel

Expose your instance publicly without opening any ports:

```bash
cloudflared tunnel login
cloudflared tunnel create forge
cloudflared tunnel route dns forge api.yourdomain.com
cloudflared tunnel route dns forge app.yourdomain.com
```

Copy `scripts/cloudflare-config.example.yml` to `~/.cloudflared/config.yml`, set your tunnel ID, then run:

```bash
cloudflared tunnel run forge

# Or install as a persistent service:
sudo cloudflared service install
```

<br/>

## Scaling

Forge is designed to grow with you.

1. **Add more Mac workers** for iOS — point them at the same Redis and Supabase.
2. **Add Linux VPS nodes** for Android — the worker code deploys unchanged; only the `.env` differs.
3. **Move Redis** to a managed instance (Upstash, Railway, or self-hosted).
4. **Upgrade Supabase** to Pro for production workloads.

No application code changes are required to scale — only `REDIS_URL` and `SUPABASE_URL` in the worker `.env`.

<br/>

## Contributing

Contributions are welcome. Before opening a PR:

1. **Open an issue** to discuss substantial changes before starting work.
2. **Follow the existing code style** — TypeScript strict mode, Prettier defaults.
3. **Include tests** for new behavior where practical.
4. By submitting a pull request, you agree to license your contribution under the [Apache License 2.0](LICENSE).

Good first issues and help-wanted tasks are tagged in the [issue tracker](https://github.com/Lange-Logic-LLC/forge/issues).

<br/>

## Community & Support

- **Bug reports & feature requests** — [GitHub Issues](https://github.com/Lange-Logic-LLC/forge/issues)
- **Questions & ideas** — [GitHub Discussions](https://github.com/Lange-Logic-LLC/forge/discussions)
- **Security disclosure** — see [`SECURITY.md`](SECURITY.md)
- **Commercial support & hosting** — [Lange Logic LLC](https://github.com/Lange-Logic-LLC)

<br/>

## Trademarks

**Forge** is a trademark of Lange Logic LLC.

All other product names, logos, and brands referenced in this repository or its documentation are the property of their respective owners. All company, product, and service names used in this documentation are for identification purposes only. Use of these names, logos, and brands does not imply endorsement.

**Forge is an independent project.** It is not affiliated with, authorized by, endorsed by, or in any way officially connected with Expo, 650 Industries, Inc., or Expo Application Services (EAS). References to `eas.json` and to commercial build services elsewhere in this documentation are descriptive and nominative only — they identify a common configuration file format and category of competing products, and do not represent any affiliation or compatibility claim sanctioned by those parties.

If you are a trademark holder and believe any content in this repository misrepresents your mark, please contact Lange Logic LLC via the [GitHub org page](https://github.com/Lange-Logic-LLC) and we will respond promptly.

<br/>

## License

Forge is licensed under the [Apache License, Version 2.0](LICENSE).

```
Copyright 2026 Lange Logic LLC

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
implied. See the License for the specific language governing permissions
and limitations under the License.
```

<br/>

<div align="center">
  <sub>
    Built with care by <a href="https://github.com/Lange-Logic-LLC">Lange Logic LLC</a>.
  </sub>
</div>
