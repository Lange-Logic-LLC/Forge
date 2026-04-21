# Security Policy

## Supported Versions

Forge is pre-`1.0` and under active development. Security fixes are applied to the `main` branch. Once `1.0` ships, this table will list the supported release lines.

| Version | Supported |
| --- | --- |
| `main` (development) | :white_check_mark: |
| `< 1.0` | :white_check_mark: (best-effort) |

## Reporting a Vulnerability

**Please do not file public GitHub issues for security vulnerabilities.** Public disclosure before a fix is available puts every Forge operator at risk.

### Preferred: GitHub Private Vulnerability Reporting

1. Go to the repository's **Security** tab.
2. Click **Report a vulnerability**.
3. Fill in the form with a description, reproduction steps, and any proof-of-concept.

This creates a private channel between you and the maintainers. Neither the report nor the discussion is visible to the public until a fix is released and a CVE (if applicable) is published.

### Alternative: Email

If GitHub private reporting is not an option, contact the maintainers directly:

- **Email:** `security@langelogic.com`

Please include:

- A clear description of the vulnerability.
- The affected component (`api`, `worker`, `cli`, `dashboard`, `shared`, or `supabase` migrations).
- Steps to reproduce.
- The version or commit hash you tested against.
- Any proof-of-concept code or artifacts.
- Your preferred credit name for the security advisory (optional).

## What to Expect

| Stage | Target Timeframe |
| --- | --- |
| Initial acknowledgement | Within 3 business days |
| Triage and severity assessment | Within 7 business days |
| Fix or mitigation plan | Within 30 days for high/critical issues |
| Public disclosure | After a fix is released, coordinated with you |

We follow responsible-disclosure practice: no public disclosure before a fix is available, and we will credit you in the resulting advisory unless you prefer to remain anonymous.

## Scope

In scope:

- The Forge API server (`packages/api`)
- The Forge worker (`packages/worker`)
- The Forge CLI (`packages/cli`)
- The Forge dashboard (`apps/dashboard`)
- Shared libraries (`packages/shared`)
- Supabase migrations and RLS policies (`supabase/migrations`)
- Credential encryption and handling
- Tenant isolation (org-to-org data access)
- Authentication and authorization logic

Out of scope:

- Vulnerabilities in upstream dependencies — please report those to the upstream project. We will update the dependency once a fix is published.
- Issues that require physical access to a Forge operator's hardware.
- Issues in operator-specific configurations (e.g. misconfigured Cloudflare Tunnel, misconfigured Supabase RLS overrides).
- Denial-of-service attacks against a specific operator's instance.

## Hall of Fame

Security researchers who have responsibly disclosed vulnerabilities will be credited here (with permission) once `1.0` ships.

---

Thank you for helping keep Forge and its users safe.
