import { supabase } from '../lib/supabase.js';
import type { Organization } from '@forge/shared';

export async function checkBuildLimits(org: Organization): Promise<{ allowed: boolean; error?: string }> {
  if (org.builds_used_this_month >= org.builds_limit) {
    return {
      allowed: false,
      error: `Monthly build limit reached (${org.builds_used_this_month}/${org.builds_limit}). Upgrade your plan or wait until next month.`,
    };
  }

  // Check concurrent builds
  const { count } = await supabase
    .from('builds')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', org.id)
    .in('status', ['queued', 'building']);

  if ((count ?? 0) >= org.concurrent_limit) {
    return {
      allowed: false,
      error: `Concurrent build limit reached (${count}/${org.concurrent_limit}). Wait for a build to finish or upgrade your plan.`,
    };
  }

  return { allowed: true };
}
