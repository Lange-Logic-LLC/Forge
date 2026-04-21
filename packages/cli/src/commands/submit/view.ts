import { Command } from 'commander';
import chalk from 'chalk';
import { requireAuth } from '../../lib/config.js';
import { getApi } from '../../lib/api.js';
import { statusColor } from '../../utils/table.js';

export const submitViewCommand = new Command('submit:view')
  .description('View submission details')
  .argument('<id>', 'Submission ID')
  .action(async (id) => {
    const { org } = await requireAuth();
    const api = await getApi();

    const { data: sub } = await api.get(`/orgs/${org}/submissions/${id}`);

    console.log(chalk.bold('Submission Details'));
    console.log(`  ID:        ${sub.id}`);
    console.log(`  Build:     ${sub.build_id}`);
    console.log(`  Platform:  ${sub.platform}`);
    console.log(`  Track:     ${sub.track}`);
    console.log(`  Status:    ${statusColor(sub.status)}`);
    console.log(`  Created:   ${new Date(sub.created_at).toLocaleString()}`);
    if (sub.store_url) {
      console.log(`  Store URL: ${chalk.cyan(sub.store_url)}`);
    }
    if (sub.error_message) {
      console.log(`  Error:     ${chalk.red(sub.error_message)}`);
    }
  });
