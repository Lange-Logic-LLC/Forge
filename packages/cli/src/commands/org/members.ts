import { Command } from 'commander';
import { requireAuth } from '../../lib/config.js';
import { getApi } from '../../lib/api.js';
import { printTable } from '../../utils/table.js';

export const orgMembersCommand = new Command('members')
  .description('List organization members')
  .action(async () => {
    const { org } = await requireAuth();
    const api = await getApi();

    const { data } = await api.get(`/orgs/${org}/members`);

    if (!data?.length) {
      console.log('No members found.');
      return;
    }

    printTable(
      ['Email', 'Name', 'Role', 'Joined'],
      data.map((m: any) => [
        m.profiles?.email ?? 'unknown',
        m.profiles?.display_name ?? '-',
        m.role,
        new Date(m.joined_at).toLocaleString(),
      ]),
    );
  });
