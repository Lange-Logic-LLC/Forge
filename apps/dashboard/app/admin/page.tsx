import { createClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';

export default async function AdminPage() {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect('/auth');

  // Check admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', session.user.id)
    .single();

  if (!profile?.is_admin) {
    return <div className="p-6">Access denied. Admin only.</div>;
  }

  // All orgs
  const { data: orgs } = await supabase
    .from('organizations')
    .select('*')
    .order('created_at', { ascending: false });

  // All workers
  const { data: workers } = await supabase
    .from('workers')
    .select('*')
    .order('last_ping', { ascending: false });

  // Recent builds
  const { data: builds } = await supabase
    .from('builds')
    .select('*, organizations(name, slug)')
    .order('created_at', { ascending: false })
    .limit(20);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <h1 className="text-2xl font-bold">Admin Dashboard</h1>

      <section>
        <h2 className="text-xl font-semibold mb-3">Workers</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {workers?.map((w: any) => {
            const isOffline = Date.now() - new Date(w.last_ping).getTime() > 120000;
            return (
              <div key={w.id} className="border rounded p-4">
                <div className="font-medium">{w.id}</div>
                <div className="text-sm text-gray-500">{w.platform} &middot; {w.hostname}</div>
                <div className={`text-sm mt-1 ${isOffline ? 'text-red-500' : w.status === 'busy' ? 'text-yellow-500' : 'text-green-500'}`}>
                  {isOffline ? 'offline' : w.status}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  Last ping: {new Date(w.last_ping).toLocaleString()}
                </div>
              </div>
            );
          })}
          {!workers?.length && <p className="text-gray-500">No workers registered.</p>}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-3">Organizations ({orgs?.length ?? 0})</h2>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b text-left text-sm text-gray-500">
              <th className="py-2 pr-4">Name</th>
              <th className="py-2 pr-4">Slug</th>
              <th className="py-2 pr-4">Plan</th>
              <th className="py-2 pr-4">Builds</th>
              <th className="py-2">Active</th>
            </tr>
          </thead>
          <tbody>
            {orgs?.map((org: any) => (
              <tr key={org.id} className="border-b">
                <td className="py-2 pr-4">{org.name}</td>
                <td className="py-2 pr-4 font-mono text-sm">{org.slug}</td>
                <td className="py-2 pr-4">{org.plan}</td>
                <td className="py-2 pr-4">{org.builds_used_this_month}/{org.builds_limit}</td>
                <td className="py-2">{org.is_active ? 'Yes' : 'No'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-3">Recent Builds</h2>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b text-left text-sm text-gray-500">
              <th className="py-2 pr-4">ID</th>
              <th className="py-2 pr-4">Org</th>
              <th className="py-2 pr-4">Platform</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2">Created</th>
            </tr>
          </thead>
          <tbody>
            {builds?.map((b: any) => (
              <tr key={b.id} className="border-b">
                <td className="py-2 pr-4 font-mono text-sm">{b.id.slice(0, 8)}</td>
                <td className="py-2 pr-4">{(b.organizations as any)?.slug ?? '-'}</td>
                <td className="py-2 pr-4">{b.platform}</td>
                <td className="py-2 pr-4">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                    b.status === 'success' ? 'bg-green-100 text-green-800' :
                    b.status === 'failed' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>{b.status}</span>
                </td>
                <td className="py-2 text-sm">{new Date(b.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
