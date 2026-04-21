import { Command } from 'commander';
import chalk from 'chalk';
import { requireAuth } from '../../lib/config.js';
import { getApi } from '../../lib/api.js';

export const credentialsRemoveCommand = new Command('remove')
  .description('Remove a credential')
  .argument('<id>', 'Credential ID')
  .action(async (id) => {
    const { org } = await requireAuth();
    const api = await getApi();

    try {
      await api.delete(`/orgs/${org}/credentials/${id}`);
      console.log(chalk.green('Credential removed.'));
    } catch (err: any) {
      console.error(chalk.red('Error:'), err.response?.data?.error ?? err.message);
      process.exit(1);
    }
  });
