import { buildQueueIos, buildQueueAndroid, submitQueue, webhookQueue, cleanupQueue } from './client.js';
import type { Platform } from '@forge/shared';

export async function enqueueBuild(
  buildId: string,
  orgId: string,
  platform: Platform,
  plan: string,
) {
  const priority = { enterprise: 1, team: 2, pro: 3, starter: 4 }[plan] ?? 4;
  const queue = platform === 'ios' ? buildQueueIos : buildQueueAndroid;

  await queue.add('build', { buildId, orgId, platform }, {
    priority,
    attempts: 2,
    backoff: { type: 'exponential', delay: 30_000 },
    removeOnComplete: 500,
    removeOnFail: 1000,
  });
}

export async function enqueueSubmission(
  submissionId: string,
  orgId: string,
  platform: Platform,
) {
  await submitQueue.add('submit', { submissionId, orgId, platform }, {
    attempts: 2,
    backoff: { type: 'exponential', delay: 30_000 },
    removeOnComplete: 200,
    removeOnFail: 500,
  });
}

export async function enqueueWebhook(
  webhookId: string,
  buildId: string,
  event: string,
) {
  await webhookQueue.add('webhook', { webhookId, buildId, event }, {
    attempts: 5,
    backoff: { type: 'exponential', delay: 5000 },
  });
}

export async function enqueueArtifactCleanup(buildId: string, expiresAt: Date) {
  await cleanupQueue.add('expire-artifact', { buildId }, {
    delay: expiresAt.getTime() - Date.now(),
  });
}
