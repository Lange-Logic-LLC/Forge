import { Command } from 'commander';
import chalk from 'chalk';
import { requireAuth } from '../../lib/config.js';
import { getApi } from '../../lib/api.js';
import { printTable, statusColor } from '../../utils/table.js';

export const buildListCommand = new Command('build:list')
  .description('List builds')
  .option('-p, --platform <platform>', 'Filter by platform')
  .option('-s, --status <status>', 'Filter by status')
  .option('-l, --limit <n>', 'Number of results', '20')
  .action(async (opts) => {
    const { org } = await requireAuth();
    const api = await getApi();

    const params = new URLSearchParams();
    if (opts.platform) params.set('platform', opts.platform);
    if (opts.status) params.set('status', opts.status);
    params.set('limit', opts.limit);

    const { data } = await api.get(`/orgs/${org}/builds?${params}`);

    if (!data.builds?.length) {
      console.log('No builds found.');
      return;
    }

    printTable(
      ['ID', 'Platform', 'Profile', 'Status', 'Created'],
      data.builds.map((b: any) => [
        b.id.slice(0, 8),
        b.platform,
        b.profile,
        statusColor(b.status),
        new Date(b.created_at).toLocaleString(),
      ]),
    );

    console.log(chalk.gray(`\nShowing ${data.builds.length} of ${data.total} builds`));
  });
