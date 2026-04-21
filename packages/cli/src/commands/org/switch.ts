import { Command } from 'commander';
import chalk from 'chalk';
import { requireAuth, saveConfig } from '../../lib/config.js';
import { getApi } from '../../lib/api.js';

export const orgSwitchCommand = new Command('switch')
  .description('Switch active organization')
  .argument('[slug]', 'Organization slug')
  .action(async (slug) => {
    const { config } = await requireAuth();
    const api = await getApi();

    if (!slug) {
      // List orgs and let user pick
      const { data: orgs } = await api.get('/orgs');
      if (!orgs.length) {
        console.log('No organizations. Run: forge org:create');
        return;
      }

      for (const org of orgs) {
        const marker = org.slug === config.activeOrg ? chalk.green(' (active)') : '';
        console.log(`  ${chalk.bold(org.slug)} — ${org.name} (${org.plan})${marker}`);
      }
      return;
    }

    // Verify org exists and user has access
    try {
      await api.get(`/orgs/${slug}`);
      await saveConfig({ activeOrg: slug });
      console.log(chalk.green(`Switched to: ${slug}`));
    } catch {
      console.error(chalk.red(`Organization not found or no access: ${slug}`));
      process.exit(1);
    }
  });
