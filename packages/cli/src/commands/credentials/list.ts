import { Command } from 'commander';
import { requireAuth } from '../../lib/config.js';
import { getApi } from '../../lib/api.js';
import { printTable } from '../../utils/table.js';

export const credentialsListCommand = new Command('list')
  .description('List stored credentials')
  .action(async () => {
    const { org } = await requireAuth();
    const api = await getApi();

    const { data } = await api.get(`/orgs/${org}/credentials`);

    if (!data?.length) {
      console.log('No credentials stored.');
      return;
    }

    printTable(
      ['ID', 'Label', 'Type', 'Platform', 'Created'],
      data.map((c: any) => [
        c.id.slice(0, 8),
        c.label,
        c.type,
        c.platform,
        new Date(c.created_at).toLocaleString(),
      ]),
    );
  });
