import type { FastifyInstance } from 'fastify';
import crypto from 'crypto';
import { supabase } from '../../lib/supabase.js';
import { createWebhookSchema } from '@forge/shared';

export async function webhookRoutes(fastify: FastifyInstance) {
  // Register webhook
  fastify.post<{ Params: { slug: string } }>('/:slug/webhooks', async (req, reply) => {
    if (!req.org) return reply.status(404).send({ error: 'Not found' });

    const body = createWebhookSchema.parse(req.body);
    const secret = `whsec_${crypto.randomBytes(24).toString('hex')}`;

    const { data, error } = await supabase
      .from('webhooks')
      .insert({
        org_id: req.org.id,
        url: body.url,
        secret,
        events: body.events,
      })
      .select()
      .single();

    if (error) return reply.status(500).send({ error: error.message });

    // Return secret once — it's stored but not shown again in list
    return reply.status(201).send(data);
  });

  // List webhooks
  fastify.get<{ Params: { slug: string } }>('/:slug/webhooks', async (req, reply) => {
    if (!req.org) return reply.status(404).send({ error: 'Not found' });

    const { data, error } = await supabase
      .from('webhooks')
      .select('id, org_id, url, events, is_active, created_at')
      .eq('org_id', req.org.id)
      .order('created_at', { ascending: false });

    if (error) return reply.status(500).send({ error: error.message });
    return data;
  });

  // Delete webhook
  fastify.delete<{ Params: { slug: string; id: string } }>(
    '/:slug/webhooks/:id',
    async (req, reply) => {
      if (!req.org) return reply.status(404).send({ error: 'Not found' });

      const { error } = await supabase
        .from('webhooks')
        .delete()
        .eq('id', req.params.id)
        .eq('org_id', req.org.id);

      if (error) return reply.status(500).send({ error: error.message });
      return reply.status(204).send();
    },
  );
}
