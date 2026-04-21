import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { requireAuth, saveConfig } from '../../lib/config.js';
import { getApi } from '../../lib/api.js';

export const orgCreateCommand = new Command('create')
  .description('Create an organization')
  .action(async () => {
    await requireAuth();
    const api = await getApi();

    const answers = await inquirer.prompt([
      { type: 'input', name: 'name', message: 'Organization name:' },
      {
        type: 'input',
        name: 'slug',
        message: 'URL slug (lowercase, alphanumeric, dashes):',
        validate: (v: string) => /^[a-z0-9-]+$/.test(v) || 'Must be lowercase alphanumeric with dashes',
      },
    ]);

    try {
      const { data: org } = await api.post('/orgs', answers);
      await saveConfig({ activeOrg: org.slug });

      console.log(chalk.green(`Organization created: ${org.name}`));
      console.log(`  Slug: ${org.slug}`);
      console.log(`  Plan: ${org.plan}`);
      console.log(`  Active org set to: ${chalk.bold(org.slug)}`);
    } catch (err: any) {
      console.error(chalk.red('Error:'), err.response?.data?.error ?? err.message);
      process.exit(1);
    }
  });
