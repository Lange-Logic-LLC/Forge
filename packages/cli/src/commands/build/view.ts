import { Command } from 'commander';
import chalk from 'chalk';
import { requireAuth } from '../../lib/config.js';
import { getApi } from '../../lib/api.js';
import { statusColor } from '../../utils/table.js';

export const buildViewCommand = new Command('build:view')
  .description('View build details')
  .argument('<id>', 'Build ID')
  .action(async (id) => {
    const { org } = await requireAuth();
    const api = await getApi();

    const { data: build } = await api.get(`/orgs/${org}/builds/${id}`);

    console.log(chalk.bold('Build Details'));
    console.log(`  ID:        ${build.id}`);
    console.log(`  Platform:  ${build.platform}`);
    console.log(`  Profile:   ${build.profile}`);
    console.log(`  Status:    ${statusColor(build.status)}`);
    console.log(`  Created:   ${new Date(build.created_at).toLocaleString()}`);

    if (build.started_at) {
      console.log(`  Started:   ${new Date(build.started_at).toLocaleString()}`);
    }
    if (build.finished_at) {
      console.log(`  Finished:  ${new Date(build.finished_at).toLocaleString()}`);
    }
    if (build.build_duration_seconds) {
      console.log(`  Duration:  ${build.build_duration_seconds}s`);
    }
    if (build.worker_id) {
      console.log(`  Worker:    ${build.worker_id}`);
    }
    if (build.artifact_url) {
      console.log(`  Artifact:  ${chalk.cyan(build.artifact_url)}`);
    }
    if (build.error_message) {
      console.log(`  Error:     ${chalk.red(build.error_message)}`);
    }
  });
