-- Seed data for development
-- Note: In development, create users through Supabase Auth first,
-- then their profiles will be auto-created by the trigger.
-- This seed creates sample orgs and builds for testing.

-- Sample organizations (you'll link these to real users after signup)
insert into organizations (id, name, slug, plan, builds_limit, concurrent_limit, artifact_ttl_days)
values
  ('00000000-0000-0000-0000-000000000001', 'Forge Demo', 'forge-demo', 'pro', 200, 3, 30),
  ('00000000-0000-0000-0000-000000000002', 'Acme Corp', 'acme', 'starter', 25, 1, 7);

-- Sample workers
insert into workers (id, platform, status, hostname, version)
values
  ('mac-local-ios', 'ios', 'idle', 'localhost', '0.1.0'),
  ('mac-local-android', 'android', 'idle', 'localhost', '0.1.0');
