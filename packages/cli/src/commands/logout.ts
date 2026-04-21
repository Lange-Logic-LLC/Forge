import { Command } from 'commander';
import chalk from 'chalk';
import { saveConfig } from '../lib/config.js';

export const logoutCommand = new Command('logout')
  .description('Log out of Forge')
  .action(async () => {
    await saveConfig({ token: null, activeOrg: null });
    console.log(chalk.green('Logged out.'));
  });
