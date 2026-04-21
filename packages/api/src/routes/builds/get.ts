import type { FastifyInstance } from 'fastify';
import { supabase } from '../../lib/supabase.js';

export async function buildGetRoutes(fastify: FastifyInstance) {
  fastify.get<{ Params: { slug: string; id: string } }>(
    '/:slug/builds/:id',
    async (req, reply) => {
      if (!req.org) return reply.status(404).send({ error: 'Not found' });

      const { data, error } = await supabase
        .from('builds')
        .select('*')
        .eq('id', req.params.id)
        .eq('org_id', req.org.id)
        .single();

      if (error || !data) return reply.status(404).send({ error: 'Build not found' });
      return data;
    },
  );
}
