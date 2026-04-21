import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { requireAuth } from '../../lib/config.js';
import { getApi } from '../../lib/api.js';
import { createSpinner } from '../../utils/spinner.js';

export const buildDownloadCommand = new Command('build:download')
  .description('Download build artifact')
  .argument('<id>', 'Build ID')
  .option('-o, --output <path>', 'Output path')
  .action(async (id, opts) => {
    const { org } = await requireAuth();
    const api = await getApi();

    const { data: build } = await api.get(`/orgs/${org}/builds/${id}`);

    if (!build.artifact_url) {
      console.error(chalk.red('No artifact available for this build.'));
      process.exit(1);
    }

    const ext = build.platform === 'ios' ? 'ipa' : 'apk';
    const outputPath = opts.output ?? path.join(process.cwd(), `build-${id.slice(0, 8)}.${ext}`);

    const spinner = createSpinner('Downloading artifact...');
    spinner.start();

    const response = await fetch(build.artifact_url);
    if (!response.ok) {
      spinner.fail('Download failed');
      process.exit(1);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(outputPath, buffer);

    spinner.succeed(`Downloaded to ${chalk.cyan(outputPath)} (${(buffer.length / 1024 / 1024).toFixed(1)} MB)`);
  });
