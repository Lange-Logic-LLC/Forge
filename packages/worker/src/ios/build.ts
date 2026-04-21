import type { SupabaseClient } from '@supabase/supabase-js';
import type Redis from 'ioredis';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { log, streamExec, uploadArtifact } from '../utils.js';
import { decryptJson } from '@forge/shared';
import type { IosDistributionCredential } from '@forge/shared';

interface IosSigningContext {
  keychainPath: string;
  profileDest: string;
  identity: string;
  profileName: string;
  credDir: string;
}

export async function buildIos(
  buildId: string,
  orgId: string,
  options: Record<string, any>,
  supabase: SupabaseClient,
  redis: Redis,
): Promise<string> {
  const workdir = path.join(process.env.BUILD_TMPDIR ?? '/tmp/forge-builds', buildId);
  let signing: IosSigningContext | null = null;

  try {
    await fs.mkdir(workdir, { recursive: true });

    // Clone
    await log(supabase, redis, buildId, 'Cloning repository...');
    if (options.sourceUrl) {
      // Download source zip
      const response = await fetch(options.sourceUrl);
      const buffer = Buffer.from(await response.arrayBuffer());
      const zipPath = path.join(workdir, 'source.zip');
      await fs.writeFile(zipPath, buffer);
      await streamExec(`unzip -o ${zipPath} -d ${workdir}`, { cwd: workdir }, supabase, redis, buildId);
    } else if (options.gitUrl) {
      await streamExec(
        `git clone --depth 1 --branch ${options.gitRef ?? 'main'} ${options.gitUrl} .`,
        { cwd: workdir },
        supabase, redis, buildId,
      );
    }

    // Install dependencies
    await log(supabase, redis, buildId, 'Installing dependencies...');
    const hasYarnLock = await fs.access(path.join(workdir, 'yarn.lock')).then(() => true).catch(() => false);
    const hasPnpmLock = await fs.access(path.join(workdir, 'pnpm-lock.yaml')).then(() => true).catch(() => false);

    if (hasPnpmLock) {
      await streamExec('pnpm install --frozen-lockfile', { cwd: workdir }, supabase, redis, buildId);
    } else if (hasYarnLock) {
      await streamExec('yarn install --frozen-lockfile', { cwd: workdir }, supabase, redis, buildId);
    } else {
      await streamExec('npm ci', { cwd: workdir }, supabase, redis, buildId);
    }

    // Prebuild (Expo)
    await log(supabase, redis, buildId, 'Running prebuild...');
    await streamExec('npx expo prebuild --platform ios --clean', { cwd: workdir }, supabase, redis, buildId);

    // Detect workspace/scheme
    const iosDir = path.join(workdir, 'ios');
    const files = await fs.readdir(iosDir);
    const workspace = files.find((f) => f.endsWith('.xcworkspace'));
    const scheme = workspace?.replace('.xcworkspace', '') ?? 'App';

    if (!workspace) {
      throw new Error('No .xcworkspace found in ios/ directory');
    }

    // Inject signing credentials
    if (options.credentialId || options.metadata?.credentialId) {
      const credId = options.credentialId ?? options.metadata?.credentialId;
      await log(supabase, redis, buildId, 'Injecting signing credentials...');
      signing = await injectIosCredentials(buildId, credId, workdir, supabase);
    }

    // Archive
    await log(supabase, redis, buildId, `Archiving ${scheme}...`);
    const archivePath = path.join(workdir, 'build.xcarchive');
    const archiveCmd = [
      'xcodebuild archive',
      `-workspace ios/${workspace}`,
      `-scheme ${scheme}`,
      `-archivePath ${archivePath}`,
      '-destination generic/platform=iOS',
      signing ? `CODE_SIGN_IDENTITY="${signing.identity}"` : '',
      signing ? `PROVISIONING_PROFILE_SPECIFIER="${signing.profileName}"` : '',
    ].filter(Boolean).join(' ');

    await streamExec(archiveCmd, { cwd: workdir }, supabase, redis, buildId);

    // Export IPA
    await log(supabase, redis, buildId, 'Exporting .ipa...');
    const exportPath = path.join(workdir, 'output');

    // Generate ExportOptions.plist
    const exportOptions = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key>
  <string>${options.profile === 'development' ? 'development' : 'app-store'}</string>
  <key>uploadBitcode</key>
  <false/>
  <key>uploadSymbols</key>
  <true/>
</dict>
</plist>`;
    await fs.writeFile(path.join(workdir, 'ExportOptions.plist'), exportOptions);

    await streamExec(
      `xcodebuild -exportArchive -archivePath ${archivePath} -exportPath ${exportPath} -exportOptionsPlist ${workdir}/ExportOptions.plist`,
      { cwd: workdir },
      supabase, redis, buildId,
    );

    // Find IPA
    const outputFiles = await fs.readdir(exportPath);
    const ipaFile = outputFiles.find((f) => f.endsWith('.ipa'));
    if (!ipaFile) throw new Error('No .ipa file produced');

    // Upload
    await log(supabase, redis, buildId, 'Uploading artifact...');
    const ipaPath = path.join(exportPath, ipaFile);
    return await uploadArtifact(supabase, buildId, orgId, ipaPath, 'ios');

  } finally {
    // Clean up
    if (signing) {
      await cleanIosCredentials(signing).catch(() => {});
    }
    await fs.rm(workdir, { recursive: true, force: true }).catch(() => {});
  }
}

async function injectIosCredentials(
  buildId: string,
  credentialId: string,
  workdir: string,
  supabase: SupabaseClient,
): Promise<IosSigningContext> {
  const { data: credRow } = await supabase
    .from('signing_credentials')
    .select('encrypted_payload')
    .eq('id', credentialId)
    .single();

  if (!credRow) throw new Error('Signing credential not found');

  const cred = decryptJson<IosDistributionCredential>(credRow.encrypted_payload);

  const credDir = `/tmp/forge-creds/${buildId}`;
  await fs.mkdir(credDir, { recursive: true });
  await fs.chmod(credDir, 0o700);

  const certPath = path.join(credDir, 'dist.p12');
  const profilePath = path.join(credDir, 'app.mobileprovision');
  await fs.writeFile(certPath, Buffer.from(cred.certP12B64, 'base64'));
  await fs.writeFile(profilePath, Buffer.from(cred.provisioningProfileB64, 'base64'));

  // Create temp keychain
  const keychainPath = path.join(credDir, 'build.keychain');
  const keychainPassword = '';

  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execP = promisify(exec);

  await execP(`security create-keychain -p "${keychainPassword}" ${keychainPath}`);
  await execP(`security import ${certPath} -k ${keychainPath} -P "${cred.certPassword}" -T /usr/bin/codesign`);
  await execP(`security set-keychain-settings -t 3600 ${keychainPath}`);
  await execP(`security list-keychains -s ${keychainPath}`);
  await execP(`security default-keychain -s ${keychainPath}`);
  await execP(`security unlock-keychain -p "${keychainPassword}" ${keychainPath}`);
  // Allow codesign to access the keychain without prompting
  await execP(`security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "${keychainPassword}" ${keychainPath}`);

  // Install provisioning profile
  const profileUUID = await getProfileUUID(profilePath);
  const profileDest = path.join(
    os.homedir(),
    'Library/MobileDevice/Provisioning Profiles',
    `${profileUUID}.mobileprovision`,
  );
  await fs.mkdir(path.dirname(profileDest), { recursive: true });
  await fs.copyFile(profilePath, profileDest);

  // Read the identity name from the installed certificate
  let identityName = cred.teamId;
  try {
    const { stdout } = await execP(
      `security find-identity -v -p codesigning ${keychainPath} | head -1 | sed 's/.*"\\(.*\\)".*/\\1/'`,
    );
    if (stdout.trim()) identityName = stdout.trim();
  } catch {}

  return {
    keychainPath,
    profileDest,
    identity: identityName,
    profileName: profileUUID,
    credDir,
  };
}

async function getProfileUUID(profilePath: string): Promise<string> {
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execP = promisify(exec);

  const { stdout } = await execP(
    `security cms -D -i ${profilePath} | grep -A1 UUID | grep string | sed 's/.*<string>//' | sed 's/<\\/string>.*//'`,
  );
  return stdout.trim();
}

async function cleanIosCredentials(signing: IosSigningContext) {
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execP = promisify(exec);

  await execP(`security delete-keychain ${signing.keychainPath}`).catch(() => {});
  await fs.rm(signing.profileDest, { force: true }).catch(() => {});
  await fs.rm(signing.credDir, { recursive: true, force: true }).catch(() => {});
}
