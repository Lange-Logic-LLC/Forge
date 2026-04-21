import { createClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';

export default async function BuildsPage() {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) redirect('/auth');

  // Get user's orgs
  const { data: memberships } = await supabase
    .from('org_members')
    .select('org_id, role, organizations(id, name, slug, plan, builds_used_this_month, builds_limit)')
    .eq('user_id', session.user.id);

  // Get builds for first org (or selected org from cookie)
  const org = (memberships as any)?.[0]?.organizations;
  let builds: any[] = [];

  if (org) {
    const { data } = await supabase
      .from('builds')
      .select('*')
      .eq('org_id', org.id)
      .order('created_at', { ascending: false })
      .limit(50);
    builds = data ?? [];
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Builds</h1>
        {org && (
          <div className="text-sm text-gray-500">
            {org.name} — {org.builds_used_this_month}/{org.builds_limit} builds this month
          </div>
        )}
      </div>

      {!org ? (
        <p className="text-gray-500">No organization found. Create one from the CLI.</p>
      ) : builds.length === 0 ? (
        <p className="text-gray-500">No builds yet. Start one with: forge build --platform ios</p>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b text-left text-sm text-gray-500">
              <th className="py-2 pr-4">ID</th>
              <th className="py-2 pr-4">Platform</th>
              <th className="py-2 pr-4">Profile</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4">Duration</th>
              <th className="py-2">Created</th>
            </tr>
          </thead>
          <tbody>
            {builds.map((build: any) => (
              <tr key={build.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-900">
                <td className="py-2 pr-4 font-mono text-sm">{build.id.slice(0, 8)}</td>
                <td className="py-2 pr-4">{build.platform}</td>
                <td className="py-2 pr-4">{build.profile}</td>
                <td className="py-2 pr-4">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                    build.status === 'success' ? 'bg-green-100 text-green-800' :
                    build.status === 'failed' ? 'bg-red-100 text-red-800' :
                    build.status === 'building' ? 'bg-yellow-100 text-yellow-800' :
                    build.status === 'queued' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {build.status}
                  </span>
                </td>
                <td className="py-2 pr-4 text-sm">
                  {build.build_duration_seconds ? `${build.build_duration_seconds}s` : '-'}
                </td>
                <td className="py-2 text-sm">{new Date(build.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
