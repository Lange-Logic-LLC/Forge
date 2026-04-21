import type { FastifyInstance } from 'fastify';
import { supabase } from '../../lib/supabase.js';

export async function adminWorkerRoutes(fastify: FastifyInstance) {
  fastify.get('/workers', async (req, reply) => {
    if (!req.isAdmin) return reply.status(403).send({ error: 'Admin only' });

    const { data, error } = await supabase
      .from('workers')
      .select('*')
      .order('last_ping', { ascending: false });

    if (error) return reply.status(500).send({ error: error.message });

    // Mark workers as offline if no ping in 2 minutes
    const now = Date.now();
    const workers = data?.map((w) => ({
      ...w,
      status: now - new Date(w.last_ping).getTime() > 120_000 ? 'offline' : w.status,
    }));

    return workers;
  });
}
