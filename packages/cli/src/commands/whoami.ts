import { Command } from 'commander';
import chalk from 'chalk';
import { requireAuth } from '../lib/config.js';
import { getApi } from '../lib/api.js';

export const whoamiCommand = new Command('whoami')
  .description('Show current user and organization')
  .action(async () => {
    const { org } = await requireAuth();
    const api = await getApi();

    try {
      const { data: orgData } = await api.get(`/orgs/${org}`);
      console.log(`Organization: ${chalk.bold(orgData.name)} (${orgData.slug})`);
      console.log(`Plan:         ${chalk.cyan(orgData.plan)}`);
      console.log(`Builds:       ${orgData.builds_used_this_month}/${orgData.builds_limit} this month`);
      console.log(`Concurrent:   ${orgData.concurrent_limit} max`);
    } catch (err: any) {
      console.error(chalk.red('Error:'), err.response?.data?.error ?? err.message);
      process.exit(1);
    }
  });
