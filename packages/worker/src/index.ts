import 'dotenv/config';
import { Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { createClient } from '@supabase/supabase-js';
import { buildIos } from './ios/build.js';
import { buildAndroid } from './android/build.js';
import { submitIos } from './ios/submit.js';
import { submitAndroid } from './android/submit.js';
import { log, updateBuildStatus, updateSubmissionStatus, fireWebhooks } from './utils.js';

const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const WORKER_ID = process.env.WORKER_ID ?? 'worker-local';
const PLATFORM = process.env.WORKER_PLATFORM as 'ios' | 'android';
const CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY ?? '1', 10);

if (!PLATFORM || !['ios', 'android'].includes(PLATFORM)) {
  console.error('WORKER_PLATFORM must be "ios" or "android"');
  process.exit(1);
}

// Build worker — listens to platform-specific queue
const queueName = `builds:${PLATFORM}`;
const buildWorker = new Worker(queueName, async (job) => {
  const { buildId, orgId, platform } = job.data;

  console.log(`[${WORKER_ID}] Processing build ${buildId} (${platform})`);

  await updateBuildStatus(supabase, redis, buildId, 'building', {
    worker_id: WORKER_ID,
    started_at: new Date().toISOString(),
  });

  try {
    const artifactUrl = platform === 'ios'
      ? await buildIos(buildId, orgId, job.data, supabase, redis)
      : await buildAndroid(buildId, orgId, job.data, supabase, redis);

    const startedAt = (await supabase.from('builds').select('started_at').eq('id', buildId).single()).data?.started_at;
    const duration = startedAt ? Math.round((Date.now() - new Date(startedAt).getTime()) / 1000) : null;

    await updateBuildStatus(supabase, redis, buildId, 'success', {
      artifact_url: artifactUrl,
      build_duration_seconds: duration,
      finished_at: new Date().toISOString(),
    });

    await fireWebhooks(supabase, redis, orgId, buildId, 'build.success');

    // Handle auto-submit
    const { data: build } = await supabase.from('builds').select('metadata').eq('id', buildId).single();
    if (build?.metadata?.autoSubmit) {
      await log(supabase, redis, buildId, 'Auto-submitting to store...');
      const { data: submission } = await supabase.from('submissions').insert({
        org_id: orgId,
        user_id: build.metadata.userId ?? null,
        build_id: buildId,
        platform,
        track: build.metadata.submitTrack ?? (platform === 'ios' ? 'testflight-internal' : 'internal'),
        credential_id: build.metadata.submitCredentialId ?? null,
        asc_app_id: build.metadata.ascAppId ?? null,
        android_package: build.metadata.androidPackage ?? null,
      }).select().single();

      if (submission) {
        // The submission worker will pick this up
        const { Queue } = await import('bullmq');
        const submitQueue = new Queue('submissions', { connection: redis });
        await submitQueue.add('submit', { submissionId: submission.id, orgId, platform });
      }
    }

  } catch (err: any) {
    await log(supabase, redis, buildId, `BUILD FAILED: ${err.message}`, 'error');
    await updateBuildStatus(supabase, redis, buildId, 'failed', {
      error_message: err.message,
      finished_at: new Date().toISOString(),
    });
    await fireWebhooks(supabase, redis, orgId, buildId, 'build.failed');
    throw err;
  }
}, { connection: redis, concurrency: CONCURRENCY });

// Submission worker
const submitWorker = new Worker('submissions', async (job) => {
  const { submissionId, orgId, platform } = job.data;

  console.log(`[${WORKER_ID}] Processing submission ${submissionId} (${platform})`);

  await updateSubmissionStatus(supabase, submissionId, 'submitting', {
    started_at: new Date().toISOString(),
  });

  try {
    if (platform === 'ios') {
      await submitIos(submissionId, supabase, redis);
    } else {
      await submitAndroid(submissionId, supabase, redis);
    }

    await updateSubmissionStatus(supabase, submissionId, 'success', {
      finished_at: new Date().toISOString(),
    });
  } catch (err: any) {
    await updateSubmissionStatus(supabase, submissionId, 'failed', {
      error_message: err.message,
      finished_at: new Date().toISOString(),
    });
    throw err;
  }
}, { connection: redis, concurrency: 1 });

// Heartbeat
setInterval(async () => {
  await supabase.from('workers').upsert({
    id: WORKER_ID,
    platform: PLATFORM,
    status: (buildWorker as any).running > 0 ? 'busy' : 'idle',
    current_build_id: null,
    hostname: process.env.HOSTNAME ?? 'localhost',
    version: '0.1.0',
    last_ping: new Date().toISOString(),
  });
}, 30_000);

// Graceful shutdown
async function shutdown() {
  console.log('Shutting down workers...');
  await buildWorker.close();
  await submitWorker.close();
  await redis.disconnect();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

console.log(`Forge worker started: ${WORKER_ID} (platform: ${PLATFORM}, concurrency: ${CONCURRENCY})`);
