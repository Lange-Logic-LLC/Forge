import type { SupabaseClient } from '@supabase/supabase-js';
import type Redis from 'ioredis';
import fs from 'fs/promises';
import { createReadStream } from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { log, downloadArtifact } from '../utils.js';
import { decryptJson } from '@forge/shared';
import type { AndroidServiceAccountKey } from '@forge/shared';

export async function submitAndroid(
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

  // Get service account key
  const { data: credRow } = await supabase
    .from('signing_credentials')
    .select('encrypted_payload')
    .eq('id', submission.credential_id)
    .single();

  if (!credRow) throw new Error('Service account credential not found');

  const svcKey = decryptJson<AndroidServiceAccountKey>(credRow.encrypted_payload);

  const tmpDir = `/tmp/forge-submit/${submissionId}`;
  await fs.mkdir(tmpDir, { recursive: true });

  const keyPath = path.join(tmpDir, 'svc-account.json');
  await fs.writeFile(keyPath, Buffer.from(svcKey.serviceAccountJsonB64, 'base64'));

  const aabPath = path.join(tmpDir, 'app.aab');
  await downloadArtifact(supabase, build.artifact_url, aabPath);

  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: keyPath,
      scopes: ['https://www.googleapis.com/auth/androidpublisher'],
    });

    const play = google.androidpublisher({ version: 'v3', auth });
    const packageName = submission.android_package;

    if (!packageName) throw new Error('Android package name not set');

    await log(supabase, redis, submission.build_id, `Opening edit for ${packageName}...`);
    const editRes = await play.edits.insert({ packageName });
    const editId = editRes.data.id!;

    await log(supabase, redis, submission.build_id, `Uploading .aab to track: ${submission.track}...`);
    const uploadRes = await play.edits.bundles.upload({
      packageName,
      editId,
      media: {
        mimeType: 'application/octet-stream',
        body: createReadStream(aabPath),
      },
    });

    const versionCode = uploadRes.data.versionCode!;
    await log(supabase, redis, submission.build_id, `Uploaded version code: ${versionCode}`);

    // Assign to track
    await play.edits.tracks.update({
      packageName,
      editId,
      track: submission.track,
      requestBody: {
        track: submission.track,
        releases: [{
          versionCodes: [String(versionCode)],
          status: 'completed',
        }],
      },
    });

    // Commit
    await play.edits.commit({ packageName, editId });
    await log(supabase, redis, submission.build_id, `Successfully submitted to ${submission.track} track`);

    await supabase
      .from('submissions')
      .update({ store_url: 'https://play.google.com/console/developers' })
      .eq('id', submissionId);

  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}
