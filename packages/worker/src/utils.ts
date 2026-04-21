import type { SupabaseClient } from '@supabase/supabase-js';
import type { Redis } from 'ioredis';
import { exec as execCb, type ChildProcess } from 'child_process';
import { promisify } from 'util';
import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import readline from 'readline';
import crypto from 'crypto';

const execAsync = promisify(execCb);

export async function log(
  supabase: SupabaseClient,
  redis: Redis,
  buildId: string,
  line: string,
  level: 'info' | 'warn' | 'error' = 'info',
) {
  const truncated = line.slice(0, 4096);

  // Write to DB
  await supabase.from('build_logs').insert({
    build_id: buildId,
    line: truncated,
    level,
  });

  // Publish for SSE listeners
  const message = JSON.stringify({ line: truncated, level, timestamp: new Date().toISOString() });
  await redis.rpush(`logs:${buildId}`, truncated);
  await redis.expire(`logs:${buildId}`, 86400);
  await redis.publish(`logs:${buildId}:stream`, message);
}

export async function streamExec(
  cmd: string,
  opts: { cwd?: string; env?: Record<string, string> },
  supabase: SupabaseClient,
  redis: Redis,
  buildId: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = execCb(cmd, {
      cwd: opts.cwd,
      env: { ...process.env, ...opts.env },
      maxBuffer: 50 * 1024 * 1024,
    });

    let stdout = '';

    if (child.stdout) {
      const rl = readline.createInterface({ input: child.stdout });
      rl.on('line', (line) => {
        stdout += line + '\n';
        log(supabase, redis, buildId, line).catch(() => {});
      });
    }

    if (child.stderr) {
      const rl = readline.createInterface({ input: child.stderr });
      rl.on('line', (line) => {
        log(supabase, redis, buildId, line, 'warn').catch(() => {});
      });
    }

    child.on('exit', (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`Command exited with code ${code}: ${cmd}`));
    });

    child.on('error', reject);
  });
}

export async function updateBuildStatus(
  supabase: SupabaseClient,
  redis: Redis,
  buildId: string,
  status: string,
  extra: Record<string, unknown> = {},
) {
  await supabase
    .from('builds')
    .update({ status, ...extra })
    .eq('id', buildId);

  // Notify SSE listeners of status change
  await redis.publish(
    `build:${buildId}:status`,
    JSON.stringify({ status, ...extra }),
  );
}

export async function updateSubmissionStatus(
  supabase: SupabaseClient,
  submissionId: string,
  status: string,
  extra: Record<string, unknown> = {},
) {
  await supabase
    .from('submissions')
    .update({ status, ...extra })
    .eq('id', submissionId);
}

export async function uploadArtifact(
  supabase: SupabaseClient,
  buildId: string,
  orgId: string,
  filePath: string,
  platform: string,
): Promise<string> {
  const ext = platform === 'ios' ? 'ipa' : 'apk';
  const storagePath = `${orgId}/${buildId}/build.${ext}`;

  const fileContent = createReadStream(filePath);
  const fileStat = await stat(filePath);

  const { error } = await supabase.storage
    .from('build-artifacts')
    .upload(storagePath, fileContent, {
      contentType: 'application/octet-stream',
      duplex: 'half',
    } as any);

  if (error) throw new Error(`Upload failed: ${error.message}`);

  // Update build with artifact size
  await supabase
    .from('builds')
    .update({ artifact_size_bytes: fileStat.size })
    .eq('id', buildId);

  // Get signed URL (valid for artifact TTL)
  const { data } = await supabase.storage
    .from('build-artifacts')
    .createSignedUrl(storagePath, 60 * 60 * 24 * 30); // 30 days default

  return data?.signedUrl ?? storagePath;
}

export async function downloadArtifact(
  supabase: SupabaseClient,
  artifactUrl: string,
  destPath: string,
) {
  // If it's a signed URL, download directly
  const response = await fetch(artifactUrl);
  if (!response.ok) throw new Error(`Download failed: ${response.status}`);

  const { writeFile } = await import('fs/promises');
  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(destPath, buffer);
}

export async function fireWebhooks(
  supabase: SupabaseClient,
  redis: Redis,
  orgId: string,
  buildId: string,
  event: string,
) {
  const { data: webhooks } = await supabase
    .from('webhooks')
    .select('*')
    .eq('org_id', orgId)
    .eq('is_active', true)
    .contains('events', [event]);

  if (!webhooks?.length) return;

  const { data: build } = await supabase
    .from('builds')
    .select('*')
    .eq('id', buildId)
    .single();

  for (const webhook of webhooks) {
    const payload = JSON.stringify({
      event,
      build,
      timestamp: new Date().toISOString(),
    });

    const signature = crypto
      .createHmac('sha256', webhook.secret)
      .update(payload)
      .digest('hex');

    try {
      await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forge-Signature': signature,
          'X-Forge-Event': event,
        },
        body: payload,
      });
    } catch (err) {
      console.error(`Webhook delivery failed for ${webhook.id}:`, err);
    }
  }
}
