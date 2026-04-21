-- ============================================================
-- ORGANIZATIONS
-- ============================================================

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  plan text default 'starter',
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  builds_used_this_month int default 0,
  builds_limit int default 25,
  concurrent_limit int default 1,
  artifact_ttl_days int default 7,
  is_active bool default true,
  created_at timestamptz default now()
);

-- ============================================================
-- USERS & MEMBERSHIPS
-- ============================================================

create table profiles (
  id uuid references auth.users primary key,
  email text not null,
  display_name text,
  avatar_url text,
  is_admin bool default false,
  created_at timestamptz default now()
);

create table org_members (
  org_id uuid references organizations(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  role text default 'member',
  invited_by uuid references profiles(id),
  joined_at timestamptz default now(),
  primary key (org_id, user_id)
);

create table org_invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  email text not null,
  role text default 'member',
  token text unique not null default gen_random_uuid()::text,
  invited_by uuid references profiles(id),
  expires_at timestamptz default now() + interval '7 days',
  accepted_at timestamptz,
  created_at timestamptz default now()
);

-- ============================================================
-- API KEYS
-- ============================================================

create table api_keys (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  name text not null,
  key_hash text not null unique,
  key_prefix text not null,
  last_used_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz default now()
);

-- ============================================================
-- BUILDS
-- ============================================================

create table builds (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  user_id uuid references profiles(id) not null,
  platform text not null,
  status text default 'queued',
  profile text default 'release',
  git_url text,
  git_ref text default 'main',
  git_commit_sha text,
  source_url text,
  artifact_url text,
  artifact_size_bytes bigint,
  artifact_expires_at timestamptz,
  error_message text,
  worker_id text,
  queue_duration_seconds int,
  build_duration_seconds int,
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  started_at timestamptz,
  finished_at timestamptz
);

create index idx_builds_org_created on builds(org_id, created_at desc);
create index idx_builds_active on builds(status) where status in ('queued', 'building');

-- ============================================================
-- BUILD LOGS
-- ============================================================

create table build_logs (
  id bigserial primary key,
  build_id uuid references builds(id) on delete cascade not null,
  line text not null,
  level text default 'info',
  created_at timestamptz default now()
);

create index idx_build_logs_build on build_logs(build_id, created_at);

-- ============================================================
-- SIGNING CREDENTIALS
-- ============================================================

create table signing_credentials (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade not null,
  platform text not null,
  label text not null,
  type text not null,
  encrypted_payload text not null,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

-- ============================================================
-- WORKERS
-- ============================================================

create table workers (
  id text primary key,
  platform text not null,
  org_id uuid references organizations(id),
  status text default 'idle',
  current_build_id uuid references builds(id),
  hostname text,
  version text,
  last_ping timestamptz default now(),
  registered_at timestamptz default now()
);

-- ============================================================
-- SUBMISSIONS
-- ============================================================

create table submissions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  user_id uuid references profiles(id) not null,
  build_id uuid references builds(id) not null,
  platform text not null,
  status text default 'queued',
  track text not null,
  asc_app_id text,
  android_package text,
  credential_id uuid references signing_credentials(id),
  error_message text,
  store_url text,
  created_at timestamptz default now(),
  started_at timestamptz,
  finished_at timestamptz
);

-- ============================================================
-- WEBHOOKS
-- ============================================================

create table webhooks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade not null,
  url text not null,
  secret text not null,
  events text[] default array['build.success', 'build.failed'],
  is_active bool default true,
  created_at timestamptz default now()
);

-- ============================================================
-- BILLING EVENTS
-- ============================================================

create table billing_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade not null,
  event_type text not null,
  stripe_event_id text unique,
  payload jsonb default '{}',
  created_at timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table organizations       enable row level security;
alter table org_members         enable row level security;
alter table org_invites         enable row level security;
alter table api_keys            enable row level security;
alter table builds              enable row level security;
alter table build_logs          enable row level security;
alter table signing_credentials enable row level security;
alter table submissions         enable row level security;
alter table webhooks            enable row level security;

-- Helper: is the current user a member of this org?
create or replace function is_org_member(org uuid)
returns boolean language sql security definer as $$
  select exists (
    select 1 from org_members
    where org_id = org and user_id = auth.uid()
  );
$$;

-- Helper: does the current user have at least this role?
create or replace function has_org_role(org uuid, min_role text)
returns boolean language sql security definer as $$
  select exists (
    select 1 from org_members
    where org_id = org
      and user_id = auth.uid()
      and role = any(
        case min_role
          when 'owner'  then array['owner']
          when 'admin'  then array['owner','admin']
          when 'member' then array['owner','admin','member']
          else               array['owner','admin','member','viewer']
        end
      )
  );
$$;

-- Policies
create policy "org members read orgs"         on organizations       for select using (is_org_member(id));
create policy "org owners update orgs"        on organizations       for update using (has_org_role(id, 'owner'));

create policy "members read memberships"      on org_members         for select using (is_org_member(org_id));

create policy "org members read invites"      on org_invites         for select using (is_org_member(org_id));
create policy "org admins create invites"     on org_invites         for insert with check (has_org_role(org_id, 'admin'));

create policy "members read own keys"         on api_keys            for select using (user_id = auth.uid());
create policy "members create keys"           on api_keys            for insert with check (user_id = auth.uid());
create policy "members delete own keys"       on api_keys            for delete using (user_id = auth.uid());

create policy "org members read builds"       on builds              for select using (is_org_member(org_id));
create policy "org members create builds"     on builds              for insert with check (is_org_member(org_id));
create policy "org admins update builds"      on builds              for update using (has_org_role(org_id, 'admin'));

create policy "org members read logs"         on build_logs          for select using (
  build_id in (select id from builds where is_org_member(org_id))
);

create policy "org admins manage credentials" on signing_credentials for all using (has_org_role(org_id, 'admin'));

create policy "org members read submissions"  on submissions         for select using (is_org_member(org_id));
create policy "org members create submissions" on submissions        for insert with check (is_org_member(org_id));

create policy "org admins manage webhooks"    on webhooks            for all using (has_org_role(org_id, 'admin'));

-- ============================================================
-- BUILD COUNTER TRIGGER
-- ============================================================

create or replace function increment_build_count()
returns trigger language plpgsql security definer as $$
begin
  update organizations
  set builds_used_this_month = builds_used_this_month + 1
  where id = NEW.org_id;
  return NEW;
end;
$$;

create trigger on_build_created
  after insert on builds
  for each row execute function increment_build_count();

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================

create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, email, display_name)
  values (NEW.id, NEW.email, NEW.raw_user_meta_data->>'display_name');
  return NEW;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
