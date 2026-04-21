import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { saveConfig, loadConfig } from '../lib/config.js';
import { getApi, resetApiClient } from '../lib/api.js';

export const loginCommand = new Command('login')
  .description('Log in to Forge')
  .option('--token <token>', 'API token (skip interactive login)')
  .option('--api-url <url>', 'API server URL')
  .action(async (opts) => {
    if (opts.apiUrl) {
      await saveConfig({ apiUrl: opts.apiUrl });
    }

    let token = opts.token;

    if (!token) {
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'token',
          message: 'Enter your API token (from the dashboard):',
          validate: (v: string) => v.length > 0 || 'Token is required',
        },
      ]);
      token = answers.token;
    }

    // Verify token works
    await saveConfig({ token });
    resetApiClient(); // clear cached client so new token is picked up
    try {
      const api = await getApi();
      const { data } = await api.get('/orgs');

      console.log(chalk.green('Logged in successfully!'));

      if (data.length > 0) {
        console.log(`\nYour organizations:`);
        for (const org of data) {
          console.log(`  ${chalk.bold(org.slug)} — ${org.name} (${org.plan})`);
        }

        if (data.length === 1) {
          await saveConfig({ activeOrg: data[0].slug });
          console.log(`\nActive org set to: ${chalk.bold(data[0].slug)}`);
        } else {
          console.log(`\nRun ${chalk.cyan('forge org:switch <slug>')} to set your active org.`);
        }
      } else {
        console.log(`\nNo organizations found. Run ${chalk.cyan('forge org:create')} to create one.`);
      }
    } catch (err: any) {
      await saveConfig({ token: null });
      console.error(chalk.red('Login failed:'), err.response?.data?.error ?? err.message);
      process.exit(1);
    }
  });
