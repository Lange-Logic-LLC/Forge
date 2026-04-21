import type { FastifyInstance } from 'fastify';
import { supabase } from '../../lib/supabase.js';
import { PLANS, type PlanName } from '@forge/shared';

export async function adminOrgRoutes(fastify: FastifyInstance) {
  // Admin: list all orgs
  fastify.get('/orgs', async (req, reply) => {
    if (!req.isAdmin) return reply.status(403).send({ error: 'Admin only' });

    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) return reply.status(500).send({ error: error.message });
    return data;
  });

  // Admin: override plan
  fastify.patch<{ Params: { slug: string }; Body: { plan: string } }>(
    '/orgs/:slug/plan',
    async (req, reply) => {
      if (!req.isAdmin) return reply.status(403).send({ error: 'Admin only' });

      const plan = (req.body as any).plan as PlanName;
      const config = PLANS[plan];
      if (!config) return reply.status(400).send({ error: 'Invalid plan' });

      const { data, error } = await supabase
        .from('organizations')
        .update({
          plan,
          builds_limit: config.buildsLimit === Infinity ? 999999 : config.buildsLimit,
          concurrent_limit: config.concurrentLimit,
          artifact_ttl_days: config.artifactTtlDays,
        })
        .eq('slug', req.params.slug)
        .select()
        .single();

      if (error) return reply.status(500).send({ error: error.message });
      return data;
    },
  );
}
