import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { supabase } from '../lib/supabase.js';
import type { Organization } from '@forge/shared';

declare module 'fastify' {
  interface FastifyRequest {
    org: Organization | null;
  }
}

async function tenantPluginFn(fastify: FastifyInstance) {
  fastify.decorateRequest('org', null);

  fastify.addHook('preHandler', async (req: FastifyRequest, reply: FastifyReply) => {
    // Only resolve org for /orgs/:slug/* routes
    const slug = (req.params as Record<string, string>).slug;
    if (!slug) return;

    const { data: org, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('slug', slug)
      .single();

    if (error || !org) {
      return reply.status(404).send({ error: 'Organization not found' });
    }

    // Check membership
    const { data: membership } = await supabase
      .from('org_members')
      .select('role')
      .eq('org_id', org.id)
      .eq('user_id', req.userId)
      .single();

    if (!membership && !req.isAdmin) {
      return reply.status(403).send({ error: 'Not a member of this organization' });
    }

    if (!org.is_active) {
      return reply.status(402).send({
        error: 'Subscription inactive',
        message: 'Please update your billing information to continue.',
      });
    }

    req.org = org as Organization;
  });
}

export const tenantPlugin = fp(tenantPluginFn, {
  name: 'tenant',
  dependencies: ['auth'],
});
