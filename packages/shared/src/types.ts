export type Platform = 'ios' | 'android';
export type BuildStatus = 'queued' | 'building' | 'success' | 'failed' | 'cancelled';
export type BuildProfile = 'release' | 'preview' | 'development';
export type OrgRole = 'owner' | 'admin' | 'member' | 'viewer';
export type WorkerStatus = 'idle' | 'busy' | 'offline';
export type SubmissionStatus = 'queued' | 'submitting' | 'success' | 'failed';

export type IosTrack = 'testflight-internal' | 'testflight-external' | 'app-store';
export type AndroidTrack = 'internal' | 'alpha' | 'beta' | 'production';
export type SubmitTrack = IosTrack | AndroidTrack;

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  builds_used_this_month: number;
  builds_limit: number;
  concurrent_limit: number;
  artifact_ttl_days: number;
  is_active: boolean;
  created_at: string;
}

export interface Profile {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  is_admin: boolean;
  created_at: string;
}

export interface OrgMember {
  org_id: string;
  user_id: string;
  role: OrgRole;
  invited_by: string | null;
  joined_at: string;
}

export interface Build {
  id: string;
  org_id: string;
  user_id: string;
  platform: Platform;
  status: BuildStatus;
  profile: BuildProfile;
  git_url: string | null;
  git_ref: string;
  git_commit_sha: string | null;
  source_url: string | null;
  artifact_url: string | null;
  artifact_size_bytes: number | null;
  artifact_expires_at: string | null;
  error_message: string | null;
  worker_id: string | null;
  queue_duration_seconds: number | null;
  build_duration_seconds: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export interface BuildLog {
  id: number;
  build_id: string;
  line: string;
  level: 'info' | 'warn' | 'error';
  created_at: string;
}

export interface Submission {
  id: string;
  org_id: string;
  user_id: string;
  build_id: string;
  platform: Platform;
  status: SubmissionStatus;
  track: SubmitTrack;
  asc_app_id: string | null;
  android_package: string | null;
  credential_id: string | null;
  error_message: string | null;
  store_url: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export interface Worker {
  id: string;
  platform: Platform;
  org_id: string | null;
  status: WorkerStatus;
  current_build_id: string | null;
  hostname: string | null;
  version: string | null;
  last_ping: string;
  registered_at: string;
}

export interface SigningCredential {
  id: string;
  org_id: string;
  platform: Platform;
  label: string;
  type: CredentialType;
  created_by: string | null;
  created_at: string;
}

export type CredentialType =
  | 'ios-distribution'
  | 'ios-asc-api-key'
  | 'ios-apns'
  | 'android-keystore'
  | 'android-service-account';

export interface IosDistributionCredential {
  type: 'ios-distribution';
  certP12B64: string;
  certPassword: string;
  provisioningProfileB64: string;
  provisioningProfileType: 'app-store' | 'ad-hoc' | 'enterprise' | 'development';
  teamId: string;
  bundleId: string;
  certExpiry: string;
  profileExpiry: string;
}

export interface IosAscApiKey {
  type: 'ios-asc-api-key';
  p8KeyB64: string;
  keyId: string;
  issuerId: string;
}

export interface IosApnsKey {
  type: 'ios-apns';
  p8KeyB64: string;
  keyId: string;
  teamId: string;
}

export interface AndroidKeystoreCredential {
  type: 'android-keystore';
  keystoreB64: string;
  keystorePassword: string;
  keyAlias: string;
  keyPassword: string;
  sha1Fingerprint?: string;
}

export interface AndroidServiceAccountKey {
  type: 'android-service-account';
  serviceAccountJsonB64: string;
}

export type CredentialPayload =
  | IosDistributionCredential
  | IosAscApiKey
  | IosApnsKey
  | AndroidKeystoreCredential
  | AndroidServiceAccountKey;

export interface Webhook {
  id: string;
  org_id: string;
  url: string;
  secret: string;
  events: string[];
  is_active: boolean;
  created_at: string;
}

export interface ApiKey {
  id: string;
  org_id: string;
  user_id: string;
  name: string;
  key_prefix: string;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
}
