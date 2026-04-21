import { Command } from 'commander';
import { requireAuth } from '../../lib/config.js';
import { getApi } from '../../lib/api.js';
import { printTable, statusColor } from '../../utils/table.js';

export const submitListCommand = new Command('submit:list')
  .description('List submissions')
  .action(async () => {
    const { org } = await requireAuth();
    const api = await getApi();

    const { data } = await api.get(`/orgs/${org}/submissions`);

    if (!data?.length) {
      console.log('No submissions found.');
      return;
    }

    printTable(
      ['ID', 'Platform', 'Track', 'Status', 'Created'],
      data.map((s: any) => [
        s.id.slice(0, 8),
        s.platform,
        s.track,
        statusColor(s.status),
        new Date(s.created_at).toLocaleString(),
      ]),
    );
  });
