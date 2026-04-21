import { z } from 'zod';

export const createOrgSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with dashes'),
});

export const createBuildSchema = z.object({
  platform: z.enum(['ios', 'android']),
  profile: z.enum(['release', 'preview', 'development']).default('release'),
  gitUrl: z.string().url().optional(),
  gitRef: z.string().default('main'),
  sourceUrl: z.string().url().optional(),
  credentialId: z.string().uuid().optional(),
  autoSubmit: z.boolean().default(false),
  submitTrack: z.string().optional(),
  submitCredentialId: z.string().uuid().optional(),
  ascAppId: z.string().optional(),
  androidPackage: z.string().optional(),
  metadata: z.record(z.unknown()).default({}),
});

export const createSubmissionSchema = z.object({
  buildId: z.string().uuid(),
  platform: z.enum(['ios', 'android']),
  track: z.string(),
  credentialId: z.string().uuid().optional(),
  ascAppId: z.string().optional(),
  androidPackage: z.string().optional(),
});

export const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'member', 'viewer']).default('member'),
});

export const createWebhookSchema = z.object({
  url: z.string().url(),
  events: z.array(z.string()).default(['build.success', 'build.failed']),
});

export const createApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  expiresAt: z.string().datetime().optional(),
});

export const addCredentialSchema = z.object({
  platform: z.enum(['ios', 'android']),
  label: z.string().min(1).max(100),
  type: z.enum([
    'ios-distribution',
    'ios-asc-api-key',
    'ios-apns',
    'android-keystore',
    'android-service-account',
  ]),
  payload: z.string(), // base64-encoded JSON of the credential blob
});

export const listBuildsQuerySchema = z.object({
  platform: z.enum(['ios', 'android']).optional(),
  status: z.enum(['queued', 'building', 'success', 'failed', 'cancelled']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
