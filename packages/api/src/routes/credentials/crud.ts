import type { FastifyInstance } from 'fastify';
import { supabase } from '../../lib/supabase.js';
import { encryptJson, decryptJson } from '@forge/shared';
import { addCredentialSchema } from '@forge/shared';

export async function credentialRoutes(fastify: FastifyInstance) {
  // Upload credential
  fastify.post<{ Params: { slug: string } }>('/:slug/credentials', async (req, reply) => {
    if (!req.org) return reply.status(404).send({ error: 'Not found' });

    const body = addCredentialSchema.parse(req.body);

    // Parse and re-encrypt the payload
    const payloadJson = JSON.parse(Buffer.from(body.payload, 'base64').toString('utf-8'));
    const encrypted = encryptJson(payloadJson);

    const { data, error } = await supabase
      .from('signing_credentials')
      .insert({
        org_id: req.org.id,
        platform: body.platform,
        label: body.label,
        type: body.type,
        encrypted_payload: encrypted,
        created_by: req.userId,
      })
      .select('id, org_id, platform, label, type, created_by, created_at')
      .single();

    if (error) return reply.status(500).send({ error: error.message });
    return reply.status(201).send(data);
  });

  // List credentials (never returns encrypted payload)
  fastify.get<{ Params: { slug: string } }>('/:slug/credentials', async (req, reply) => {
    if (!req.org) return reply.status(404).send({ error: 'Not found' });

    const { data, error } = await supabase
      .from('signing_credentials')
      .select('id, org_id, platform, label, type, created_by, created_at')
      .eq('org_id', req.org.id)
      .order('created_at', { ascending: false });

    if (error) return reply.status(500).send({ error: error.message });
    return data;
  });

  // Delete credential
  fastify.delete<{ Params: { slug: string; id: string } }>(
    '/:slug/credentials/:id',
    async (req, reply) => {
      if (!req.org) return reply.status(404).send({ error: 'Not found' });

      const { error } = await supabase
        .from('signing_credentials')
        .delete()
        .eq('id', req.params.id)
        .eq('org_id', req.org.id);

      if (error) return reply.status(500).send({ error: error.message });
      return reply.status(204).send();
    },
  );
}
