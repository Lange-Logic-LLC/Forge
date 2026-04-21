import type { SupabaseClient } from '@supabase/supabase-js';
import type { Redis } from 'ioredis';
import fs from 'fs/promises';
import path from 'path';
import { log, downloadArtifact } from '../utils.js';
import { decryptJson } from '@forge/shared';
import type { IosAscApiKey } from '@forge/shared';

export async function submitIos(
  submissionId: string,
  supabase: SupabaseClient,
  redis: Redis,
) {
  const { data: submission } = await supabase
    .from('submissions')
    .select('*')
    .eq('id', submissionId)
    .single();

  if (!submission) throw new Error('Submission not found');

  const { data: build } = await supabase
    .from('builds')
    .select('*')
    .eq('id', submission.build_id)
    .single();

  if (!build || !build.artifact_url) throw new Error('Build artifact not found');

  // Get ASC API key
  const { data: credRow } = await supabase
    .from('signing_credentials')
    .select('encrypted_payload')
    .eq('id', submission.credential_id)
    .single();

  if (!credRow) throw new Error('ASC API key credential not found');

  const ascKey = decryptJson<IosAscApiKey>(credRow.encrypted_payload);

  const tmpDir = `/tmp/forge-submit/${submissionId}`;
  await fs.mkdir(tmpDir, { recursive: true });

  const keyPath = path.join(tmpDir, 'AuthKey.p8');
  await fs.writeFile(keyPath, Buffer.from(ascKey.p8KeyB64, 'base64'));

  const ipaPath = path.join(tmpDir, 'app.ipa');
  await downloadArtifact(supabase, build.artifact_url, ipaPath);

  try {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execP = promisify(exec);

    // Copy key to expected location for xcrun
    const ascKeyDir = path.join(tmpDir, 'private_keys');
    await fs.mkdir(ascKeyDir, { recursive: true });
    await fs.copyFile(keyPath, path.join(ascKeyDir, `AuthKey_${ascKey.keyId}.p8`));

    const env = {
      ...process.env,
      API_PRIVATE_KEYS_DIR: ascKeyDir,
    };

    await log(supabase, redis, submission.build_id, 'Validating IPA...');
    await execP(
      `xcrun altool --validate-app -f ${ipaPath} -t ios --apiKey ${ascKey.keyId} --apiIssuer ${ascKey.issuerId} --output-format json`,
      { env },
    );

    await log(supabase, redis, submission.build_id, 'Uploading to App Store Connect...');
    await execP(
      `xcrun altool --upload-app -f ${ipaPath} -t ios --apiKey ${ascKey.keyId} --apiIssuer ${ascKey.issuerId} --output-format json`,
      { env },
    );

    await log(supabase, redis, submission.build_id, 'Successfully uploaded to App Store Connect');

    // Update with store URL
    await supabase
      .from('submissions')
      .update({
        store_url: submission.asc_app_id
          ? `https://appstoreconnect.apple.com/apps/${submission.asc_app_id}/testflight`
          : 'https://appstoreconnect.apple.com',
      })
      .eq('id', submissionId);

  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}
