import { Command } from 'commander';
import chalk from 'chalk';
import { requireAuth } from '../../lib/config.js';
import { getApi } from '../../lib/api.js';

export const orgInviteCommand = new Command('invite')
  .description('Invite a user to the organization')
  .argument('<email>', 'Email address to invite')
  .option('-r, --role <role>', 'Role: admin, member, viewer', 'member')
  .action(async (email, opts) => {
    const { org } = await requireAuth();
    const api = await getApi();

    try {
      await api.post(`/orgs/${org}/invites`, { email, role: opts.role });
      console.log(chalk.green(`Invitation sent to ${email} (${opts.role})`));
    } catch (err: any) {
      console.error(chalk.red('Error:'), err.response?.data?.error ?? err.message);
      process.exit(1);
    }
  });
