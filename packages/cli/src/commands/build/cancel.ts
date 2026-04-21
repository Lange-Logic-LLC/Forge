import { Command } from 'commander';
import chalk from 'chalk';
import { requireAuth } from '../../lib/config.js';
import { getApi } from '../../lib/api.js';

export const buildCancelCommand = new Command('build:cancel')
  .description('Cancel a build')
  .argument('<id>', 'Build ID')
  .action(async (id) => {
    const { org } = await requireAuth();
    const api = await getApi();

    try {
      await api.delete(`/orgs/${org}/builds/${id}`);
      console.log(chalk.green('Build cancelled.'));
    } catch (err: any) {
      console.error(chalk.red('Error:'), err.response?.data?.error ?? err.message);
      process.exit(1);
    }
  });
