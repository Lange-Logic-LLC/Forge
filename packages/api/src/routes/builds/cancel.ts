import type { FastifyInstance } from 'fastify';
import { supabase } from '../../lib/supabase.js';

export async function buildCancelRoutes(fastify: FastifyInstance) {
  fastify.delete<{ Params: { slug: string; id: string } }>(
    '/:slug/builds/:id',
    async (req, reply) => {
      if (!req.org) return reply.status(404).send({ error: 'Not found' });

      const { data: build } = await supabase
        .from('builds')
        .select('*')
        .eq('id', req.params.id)
        .eq('org_id', req.org.id)
        .single();

      if (!build) return reply.status(404).send({ error: 'Build not found' });

      if (!['queued', 'building'].includes(build.status)) {
        return reply.status(400).send({ error: `Cannot cancel build with status: ${build.status}` });
      }

      const { data, error } = await supabase
        .from('builds')
        .update({
          status: 'cancelled',
          finished_at: new Date().toISOString(),
        })
        .eq('id', req.params.id)
        .select()
        .single();

      if (error) return reply.status(500).send({ error: error.message });
      return data;
    },
  );
}
