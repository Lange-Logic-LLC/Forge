import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import fs from 'fs/promises';
import { requireAuth } from '../../lib/config.js';
import { getApi } from '../../lib/api.js';
import { createSpinner } from '../../utils/spinner.js';

export const credentialsAddCommand = new Command('add')
  .description('Add a signing credential')
  .option('--type <type>', 'Credential type')
  .action(async (opts) => {
    const { org } = await requireAuth();
    const api = await getApi();

    let credType = opts.type;
    if (!credType) {
      const answer = await inquirer.prompt([{
        type: 'list',
        name: 'type',
        message: 'What type of credential?',
        choices: [
          { name: 'iOS Distribution Certificate (.p12 + provisioning profile)', value: 'ios-distribution' },
          { name: 'iOS App Store Connect API Key (.p8)', value: 'ios-asc-api-key' },
          { name: 'iOS Push Notification Key (.p8)', value: 'ios-apns' },
          { name: 'Android Keystore (.jks)', value: 'android-keystore' },
          { name: 'Google Play Service Account (.json)', value: 'android-service-account' },
        ],
      }]);
      credType = answer.type;
    }

    let payload: Record<string, any> = {};
    let platform: string;
    let label: string;

    switch (credType) {
      case 'ios-distribution': {
        platform = 'ios';
        const answers = await inquirer.prompt([
          { type: 'input', name: 'label', message: 'Label for this credential:', default: 'iOS Distribution' },
          { type: 'input', name: 'certPath', message: 'Path to .p12 certificate:' },
          { type: 'password', name: 'certPassword', message: 'Certificate password:' },
          { type: 'input', name: 'profilePath', message: 'Path to .mobileprovision:' },
          { type: 'input', name: 'teamId', message: 'Apple Team ID:' },
          { type: 'input', name: 'bundleId', message: 'Bundle ID (e.g. com.company.app):' },
        ]);
        label = answers.label;
        payload = {
          type: 'ios-distribution',
          certP12B64: (await fs.readFile(answers.certPath)).toString('base64'),
          certPassword: answers.certPassword,
          provisioningProfileB64: (await fs.readFile(answers.profilePath)).toString('base64'),
          provisioningProfileType: 'app-store',
          teamId: answers.teamId,
          bundleId: answers.bundleId,
          certExpiry: '',
          profileExpiry: '',
        };
        break;
      }

      case 'ios-asc-api-key': {
        platform = 'ios';
        const answers = await inquirer.prompt([
          { type: 'input', name: 'label', message: 'Label:', default: 'ASC API Key' },
          { type: 'input', name: 'keyPath', message: 'Path to .p8 key file:' },
          { type: 'input', name: 'keyId', message: 'Key ID (from App Store Connect):' },
          { type: 'input', name: 'issuerId', message: 'Issuer ID (from App Store Connect):' },
        ]);
        label = answers.label;
        payload = {
          type: 'ios-asc-api-key',
          p8KeyB64: (await fs.readFile(answers.keyPath)).toString('base64'),
          keyId: answers.keyId,
          issuerId: answers.issuerId,
        };
        break;
      }

      case 'ios-apns': {
        platform = 'ios';
        const answers = await inquirer.prompt([
          { type: 'input', name: 'label', message: 'Label:', default: 'APNs Key' },
          { type: 'input', name: 'keyPath', message: 'Path to .p8 APNs key:' },
          { type: 'input', name: 'keyId', message: 'Key ID:' },
          { type: 'input', name: 'teamId', message: 'Team ID:' },
        ]);
        label = answers.label;
        payload = {
          type: 'ios-apns',
          p8KeyB64: (await fs.readFile(answers.keyPath)).toString('base64'),
          keyId: answers.keyId,
          teamId: answers.teamId,
        };
        break;
      }

      case 'android-keystore': {
        platform = 'android';
        const answers = await inquirer.prompt([
          { type: 'input', name: 'label', message: 'Label:', default: 'Android Keystore' },
          { type: 'input', name: 'keystorePath', message: 'Path to .jks keystore:' },
          { type: 'password', name: 'keystorePassword', message: 'Keystore password:' },
          { type: 'input', name: 'keyAlias', message: 'Key alias:' },
          { type: 'password', name: 'keyPassword', message: 'Key password:' },
        ]);
        label = answers.label;
        payload = {
          type: 'android-keystore',
          keystoreB64: (await fs.readFile(answers.keystorePath)).toString('base64'),
          keystorePassword: answers.keystorePassword,
          keyAlias: answers.keyAlias,
          keyPassword: answers.keyPassword,
        };
        break;
      }

      case 'android-service-account': {
        platform = 'android';
        const answers = await inquirer.prompt([
          { type: 'input', name: 'label', message: 'Label:', default: 'Google Play Service Account' },
          { type: 'input', name: 'jsonPath', message: 'Path to service account .json:' },
        ]);
        label = answers.label;
        payload = {
          type: 'android-service-account',
          serviceAccountJsonB64: (await fs.readFile(answers.jsonPath)).toString('base64'),
        };
        break;
      }

      default:
        console.error(chalk.red(`Unknown credential type: ${credType}`));
        process.exit(1);
    }

    const spinner = createSpinner('Uploading credential...');
    spinner.start();

    try {
      const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64');

      const { data } = await api.post(`/orgs/${org}/credentials`, {
        platform: platform!,
        label: label!,
        type: credType,
        payload: encodedPayload,
      });

      spinner.succeed(`Credential stored: ${data.id}`);
      console.log(`  Label:    ${data.label}`);
      console.log(`  Type:     ${data.type}`);
      console.log(`  Platform: ${data.platform}`);
    } catch (err: any) {
      spinner.fail('Failed to store credential');
      console.error(chalk.red(err.response?.data?.error ?? err.message));
      process.exit(1);
    }
  });
