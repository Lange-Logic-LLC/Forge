import type { SupabaseClient } from '@supabase/supabase-js';
import type Redis from 'ioredis';
import fs from 'fs/promises';
import path from 'path';
import { log, streamExec, uploadArtifact } from '../utils.js';
import { decryptJson } from '@forge/shared';
import type { AndroidKeystoreCredential } from '@forge/shared';

export async function buildAndroid(
  buildId: string,
  orgId: string,
  options: Record<string, any>,
  supabase: SupabaseClient,
  redis: Redis,
): Promise<string> {
  const workdir = path.join(process.env.BUILD_TMPDIR ?? '/tmp/forge-builds', buildId);
  let credDir: string | null = null;

  try {
    await fs.mkdir(workdir, { recursive: true });

    // Clone / download source
    await log(supabase, redis, buildId, 'Cloning repository...');
    if (options.sourceUrl) {
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

    // Install deps
    await log(supabase, redis, buildId, 'Installing dependencies...');
    const hasPnpmLock = await fs.access(path.join(workdir, 'pnpm-lock.yaml')).then(() => true).catch(() => false);
    const hasYarnLock = await fs.access(path.join(workdir, 'yarn.lock')).then(() => true).catch(() => false);

    if (hasPnpmLock) {
      await streamExec('pnpm install --frozen-lockfile', { cwd: workdir }, supabase, redis, buildId);
    } else if (hasYarnLock) {
      await streamExec('yarn install --frozen-lockfile', { cwd: workdir }, supabase, redis, buildId);
    } else {
      await streamExec('npm ci', { cwd: workdir }, supabase, redis, buildId);
    }

    // Prebuild
    await log(supabase, redis, buildId, 'Running prebuild...');
    await streamExec('npx expo prebuild --platform android --clean', { cwd: workdir }, supabase, redis, buildId);

    // Inject signing credentials
    const credId = options.credentialId ?? options.metadata?.credentialId;
    if (credId) {
      await log(supabase, redis, buildId, 'Injecting signing credentials...');
      credDir = `/tmp/forge-creds/${buildId}`;
      await injectAndroidCredentials(buildId, credId, workdir, supabase, credDir);
    }

    // Build with Docker (isolated Linux container)
    await log(supabase, redis, buildId, 'Building APK in Docker...');

    const dockerVolumes = [
      `-v ${workdir}:/workspace`,
    ];

    if (credDir) {
      const keystorePath = path.join(credDir, 'upload.jks');
      dockerVolumes.push(`-v ${keystorePath}:/creds/keystore.jks:ro`);
    }

    const dockerCmd = [
      'docker run --rm',
      '--network=none',
      ...dockerVolumes,
      '-w /workspace',
      'forge/android-builder:latest',
      'bash -c "cd android && ./gradlew assembleRelease"',
    ].join(' ');

    await streamExec(dockerCmd, { cwd: workdir }, supabase, redis, buildId);

    // Find APK
    await log(supabase, redis, buildId, 'Locating build artifact...');
    const apkDir = path.join(workdir, 'android/app/build/outputs/apk/release');
    const files = await fs.readdir(apkDir).catch(() => []);
    const apkFile = files.find((f) => f.endsWith('.apk'));

    if (!apkFile) {
      // Try AAB
      const aabDir = path.join(workdir, 'android/app/build/outputs/bundle/release');
      const aabFiles = await fs.readdir(aabDir).catch(() => []);
      const aabFile = aabFiles.find((f) => f.endsWith('.aab'));

      if (!aabFile) throw new Error('No .apk or .aab file produced');

      await log(supabase, redis, buildId, 'Uploading .aab artifact...');
      return await uploadArtifact(supabase, buildId, orgId, path.join(aabDir, aabFile), 'android');
    }

    await log(supabase, redis, buildId, 'Uploading .apk artifact...');
    return await uploadArtifact(supabase, buildId, orgId, path.join(apkDir, apkFile), 'android');

  } finally {
    await fs.rm(workdir, { recursive: true, force: true }).catch(() => {});
    if (credDir) {
      await fs.rm(credDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}

async function injectAndroidCredentials(
  buildId: string,
  credentialId: string,
  workdir: string,
  supabase: SupabaseClient,
  credDir: string,
) {
  const { data: credRow } = await supabase
    .from('signing_credentials')
    .select('encrypted_payload')
    .eq('id', credentialId)
    .single();

  if (!credRow) throw new Error('Signing credential not found');

  const cred = decryptJson<AndroidKeystoreCredential>(credRow.encrypted_payload);

  await fs.mkdir(credDir, { recursive: true });
  await fs.chmod(credDir, 0o700);

  const keystorePath = path.join(credDir, 'upload.jks');
  await fs.writeFile(keystorePath, Buffer.from(cred.keystoreB64, 'base64'));

  // Append signing config to gradle.properties
  const gradlePropsPath = path.join(workdir, 'android/gradle.properties');
  const signingProps = `
MYAPP_UPLOAD_STORE_FILE=/creds/keystore.jks
MYAPP_UPLOAD_KEY_ALIAS=${cred.keyAlias}
MYAPP_UPLOAD_STORE_PASSWORD=${cred.keystorePassword}
MYAPP_UPLOAD_KEY_PASSWORD=${cred.keyPassword}
`;
  await fs.appendFile(gradlePropsPath, signingProps);
}
