import { Redis } from 'ioredis';

export const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null, // required by BullMQ
  enableOfflineQueue: false,
});

// Connection config for BullMQ queues (each queue gets its own connection)
export const redisConnectionOpts = {
  host: new URL(process.env.REDIS_URL ?? 'redis://localhost:6379').hostname || 'localhost',
  port: parseInt(new URL(process.env.REDIS_URL ?? 'redis://localhost:6379').port || '6379', 10),
  maxRetriesPerRequest: null,
};
