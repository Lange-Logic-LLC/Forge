import { Command } from 'commander';
import chalk from 'chalk';
import { requireAuth, loadEasConfig } from '../../lib/config.js';
import { getApi } from '../../lib/api.js';
import { zipAndUploadProject } from '../../lib/upload.js';
import { streamBuildLogs } from '../../lib/stream.js';
import { createSpinner } from '../../utils/spinner.js';
import { statusColor } from '../../utils/table.js';

export const buildCommand = new Command('build')
  .description('Start a build')
  .requiredOption('-p, --platform <platform>', 'Platform: ios, android, or all')
  .option('--profile <profile>', 'Build profile from eas.json', 'release')
  .option('--no-wait', 'Don\'t wait for build to complete')
  .option('--auto-submit', 'Submit to store after successful build')
  .option('--track <track>', 'Submission track (with --auto-submit)')
  .action(async (opts) => {
    const { org } = await requireAuth();
    const api = await getApi();
    const easConfig = await loadEasConfig();

    const platforms = opts.platform === 'all' ? ['ios', 'android'] : [opts.platform];

    for (const platform of platforms) {
      console.log(chalk.bold(`\nStarting ${platform} build...`));

      // Resolve credential from eas.json
      let credentialId: string | undefined;
      if (easConfig?.build?.[opts.profile]?.[platform]?.credentialId) {
        credentialId = easConfig.build[opts.profile][platform].credentialId;
      }

      // Resolve submit config from eas.json
      let submitConfig: Record<string, any> = {};
      if (opts.autoSubmit && easConfig?.submit?.[opts.profile]?.[platform]) {
        submitConfig = easConfig.submit[opts.profile][platform];
      }

      const spinner = createSpinner('Uploading project source...');
      spinner.start();

      let sourceUrl: string | undefined;
      try {
        sourceUrl = await zipAndUploadProject(org);
        spinner.succeed('Project uploaded');
      } catch (err: any) {
        spinner.fail('Upload failed');
        // Fall back to git URL if available
        console.log(chalk.yellow('Falling back to git-based build...'));
      }

      try {
        const { data: build } = await api.post(`/orgs/${org}/builds`, {
          platform,
          profile: opts.profile,
          sourceUrl,
          credentialId,
          autoSubmit: opts.autoSubmit ?? false,
          submitTrack: opts.track ?? submitConfig.track,
          submitCredentialId: submitConfig.ascApiKeyCredentialId ?? submitConfig.serviceAccountCredentialId,
          ascAppId: submitConfig.ascAppId,
          androidPackage: submitConfig.androidPackage,
        });

        console.log(chalk.green(`Build queued: ${build.id}`));
        console.log(`  Platform: ${build.platform}`);
        console.log(`  Profile:  ${build.profile}`);
        console.log(`  Status:   ${statusColor(build.status)}`);

        if (opts.wait === false) {
          console.log(`\nRun ${chalk.cyan(`forge build:view ${build.id}`)} to check status.`);
          continue;
        }

        // Stream logs
        console.log(chalk.gray('\n--- Build logs ---\n'));

        await streamBuildLogs(
          org,
          build.id,
          (line, level) => {
            if (level === 'error') {
              console.log(chalk.red(line));
            } else if (level === 'warn') {
              console.log(chalk.yellow(line));
            } else {
              console.log(line);
            }
          },
          (status) => {
            console.log(chalk.gray('\n--- End logs ---\n'));
            if (status === 'success') {
              console.log(chalk.green('Build succeeded!'));
            } else {
              console.log(chalk.red(`Build ${status}`));
            }
          },
        );

        // Fetch final build to get artifact URL
        const { data: finalBuild } = await api.get(`/orgs/${org}/builds/${build.id}`);
        if (finalBuild.artifact_url) {
          console.log(`\nArtifact: ${chalk.cyan(finalBuild.artifact_url)}`);
          console.log(`Run ${chalk.cyan(`forge build:download ${build.id}`)} to download.`);
        }
      } catch (err: any) {
        console.error(chalk.red('Build failed:'), err.response?.data?.error ?? err.message);
        process.exit(1);
      }
    }
  });
