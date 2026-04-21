import { Queue } from 'bullmq';
import { redisConnectionOpts } from '../lib/redis.js';

export const buildQueueIos = new Queue('builds:ios', { connection: redisConnectionOpts });
export const buildQueueAndroid = new Queue('builds:android', { connection: redisConnectionOpts });
export const submitQueue = new Queue('submissions', { connection: redisConnectionOpts });
export const webhookQueue = new Queue('webhooks', { connection: redisConnectionOpts });
export const cleanupQueue = new Queue('cleanup', { connection: redisConnectionOpts });
