import { Command } from 'commander';
import chalk from 'chalk';
import { requireAuth, loadEasConfig } from '../../lib/config.js';
import { getApi } from '../../lib/api.js';
import { statusColor } from '../../utils/table.js';

export const submitCommand = new Command('submit')
  .description('Submit a build to the app store')
  .requiredOption('-p, --platform <platform>', 'Platform: ios or android')
  .option('--build-id <id>', 'Build ID to submit')
  .option('--latest', 'Submit the latest successful build')
  .option('--track <track>', 'Submission track')
  .action(async (opts) => {
    const { org } = await requireAuth();
    const api = await getApi();
    const easConfig = await loadEasConfig();

    let buildId = opts.buildId;

    // Find latest successful build if --latest
    if (opts.latest) {
      const { data } = await api.get(
        `/orgs/${org}/builds?platform=${opts.platform}&status=success&limit=1`,
      );
      if (!data.builds?.length) {
        console.error(chalk.red('No successful builds found.'));
        process.exit(1);
      }
      buildId = data.builds[0].id;
      console.log(`Using latest build: ${buildId.slice(0, 8)}`);
    }

    if (!buildId) {
      console.error(chalk.red('Provide --build-id or --latest'));
      process.exit(1);
    }

    // Resolve submit config from eas.json
    const submitProfile = easConfig?.submit?.release?.[opts.platform] ?? {};
    const track = opts.track ?? submitProfile.track ??
      (opts.platform === 'ios' ? 'testflight-internal' : 'internal');

    const credentialId =
      submitProfile.ascApiKeyCredentialId ?? submitProfile.serviceAccountCredentialId;

    try {
      const { data: submission } = await api.post(`/orgs/${org}/submissions`, {
        buildId,
        platform: opts.platform,
        track,
        credentialId,
        ascAppId: submitProfile.ascAppId,
        androidPackage: submitProfile.androidPackage,
      });

      console.log(chalk.green(`Submission queued: ${submission.id}`));
      console.log(`  Platform: ${submission.platform}`);
      console.log(`  Track:    ${submission.track}`);
      console.log(`  Status:   ${statusColor(submission.status)}`);
      console.log(`\nRun ${chalk.cyan(`forge submit:view ${submission.id}`)} to check status.`);
    } catch (err: any) {
      console.error(chalk.red('Submit failed:'), err.response?.data?.error ?? err.message);
      process.exit(1);
    }
  });
