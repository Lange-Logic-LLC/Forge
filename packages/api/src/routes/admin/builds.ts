import type { FastifyInstance } from 'fastify';
import { supabase } from '../../lib/supabase.js';

export async function adminBuildRoutes(fastify: FastifyInstance) {
  fastify.get('/builds', async (req, reply) => {
    if (!req.isAdmin) return reply.status(403).send({ error: 'Admin only' });

    const query = req.query as Record<string, string>;
    const limit = parseInt(query.limit ?? '50', 10);
    const offset = parseInt(query.offset ?? '0', 10);

    let q = supabase
      .from('builds')
      .select('*, organizations(name, slug)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (query.status) q = q.eq('status', query.status);
    if (query.platform) q = q.eq('platform', query.platform);

    const { data, count, error } = await q;
    if (error) return reply.status(500).send({ error: error.message });

    return { builds: data, total: count, limit, offset };
  });
}
