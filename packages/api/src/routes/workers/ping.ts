import type { FastifyInstance } from 'fastify';
import { supabase } from '../../lib/supabase.js';

export async function workerPingRoutes(fastify: FastifyInstance) {
  // Worker heartbeat
  fastify.post<{
    Body: {
      id: string;
      platform: string;
      status: string;
      currentBuildId?: string;
      hostname?: string;
      version?: string;
    };
  }>('/ping', async (req, reply) => {
    const { id, platform, status, currentBuildId, hostname, version } = req.body;

    const { error } = await supabase.from('workers').upsert({
      id,
      platform,
      status,
      current_build_id: currentBuildId ?? null,
      hostname: hostname ?? null,
      version: version ?? null,
      last_ping: new Date().toISOString(),
    });

    if (error) return reply.status(500).send({ error: error.message });
    return { ok: true };
  });
}
