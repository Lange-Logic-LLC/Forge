import type { FastifyInstance } from 'fastify';
import { supabase } from '../../lib/supabase.js';
import { redis } from '../../lib/redis.js';

export async function buildLogRoutes(fastify: FastifyInstance) {
  fastify.get<{ Params: { slug: string; id: string } }>(
    '/:slug/builds/:id/logs',
    async (req, reply) => {
      if (!req.org) return reply.status(404).send({ error: 'Not found' });

      // Verify build belongs to org
      const { data: build } = await supabase
        .from('builds')
        .select('id, status')
        .eq('id', req.params.id)
        .eq('org_id', req.org.id)
        .single();

      if (!build) return reply.status(404).send({ error: 'Build not found' });

      // SSE stream
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      });

      // Send existing logs from Redis buffer first (catch-up)
      const cachedLogs = await redis.lrange(`logs:${build.id}`, 0, -1);
      for (const line of cachedLogs) {
        reply.raw.write(`data: ${JSON.stringify({ line, level: 'info' })}\n\n`);
      }

      // If build is already done, send final event and close
      if (['success', 'failed', 'cancelled'].includes(build.status)) {
        reply.raw.write(`event: done\ndata: ${JSON.stringify({ status: build.status })}\n\n`);
        reply.raw.end();
        return;
      }

      // Subscribe to new logs and status changes via Redis pub/sub
      const subscriber = redis.duplicate();
      const logChannel = `logs:${build.id}:stream`;
      const statusChannel = `build:${build.id}:status`;

      await subscriber.subscribe(logChannel, statusChannel);

      // Single message handler that filters by channel
      subscriber.on('message', (ch: string, message: string) => {
        if (ch === logChannel) {
          reply.raw.write(`data: ${message}\n\n`);
        } else if (ch === statusChannel) {
          reply.raw.write(`event: status\ndata: ${message}\n\n`);
          try {
            const parsed = JSON.parse(message);
            if (['success', 'failed', 'cancelled'].includes(parsed.status)) {
              reply.raw.write(`event: done\ndata: ${message}\n\n`);
              cleanup();
            }
          } catch {}
        }
      });

      // Heartbeat to keep connection alive
      const heartbeat = setInterval(() => {
        reply.raw.write(`:heartbeat\n\n`);
      }, 15_000);

      let cleaned = false;
      function cleanup() {
        if (cleaned) return;
        cleaned = true;
        clearInterval(heartbeat);
        subscriber.unsubscribe().then(() => subscriber.quit());
        reply.raw.end();
      }

      req.raw.on('close', cleanup);
    },
  );
}
