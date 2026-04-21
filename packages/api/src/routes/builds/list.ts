import type { FastifyInstance } from 'fastify';
import { supabase } from '../../lib/supabase.js';
import { listBuildsQuerySchema } from '@forge/shared';

export async function buildListRoutes(fastify: FastifyInstance) {
  fastify.get<{ Params: { slug: string }; Querystring: Record<string, string> }>(
    '/:slug/builds',
    async (req, reply) => {
      if (!req.org) return reply.status(404).send({ error: 'Not found' });

      const query = listBuildsQuerySchema.parse(req.query);

      let q = supabase
        .from('builds')
        .select('*', { count: 'exact' })
        .eq('org_id', req.org.id)
        .order('created_at', { ascending: false })
        .range(query.offset, query.offset + query.limit - 1);

      if (query.platform) q = q.eq('platform', query.platform);
      if (query.status) q = q.eq('status', query.status);

      const { data, count, error } = await q;
      if (error) return reply.status(500).send({ error: error.message });

      return {
        builds: data,
        total: count,
        limit: query.limit,
        offset: query.offset,
      };
    },
  );
}
