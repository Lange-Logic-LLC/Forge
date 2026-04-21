import type { FastifyInstance } from 'fastify';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { supabase } from '../../lib/supabase.js';
import { createApiKeySchema } from '@forge/shared';

export async function authRoutes(fastify: FastifyInstance) {
  // Create an API key for the authenticated user
  fastify.post<{
    Body: { name: string; orgId: string; expiresAt?: string };
  }>('/token', async (req, reply) => {
    const body = createApiKeySchema.parse(req.body);
    const orgId = (req.body as any).orgId;

    if (!orgId) {
      return reply.status(400).send({ error: 'orgId is required' });
    }

    // Generate a random API key
    const rawKey = `forge_${crypto.randomBytes(32).toString('hex')}`;
    const keyHash = await bcrypt.hash(rawKey, 10);
    const keyPrefix = rawKey.slice(0, 14); // "forge_" + 8 chars

    const { data, error } = await supabase.from('api_keys').insert({
      org_id: orgId,
      user_id: req.userId,
      name: body.name,
      key_hash: keyHash,
      key_prefix: keyPrefix,
      expires_at: body.expiresAt ?? null,
    }).select().single();

    if (error) {
      return reply.status(500).send({ error: error.message });
    }

    // Return the raw key ONCE — it's never retrievable again
    return reply.status(201).send({
      id: data.id,
      key: rawKey,
      name: data.name,
      prefix: keyPrefix,
      expiresAt: data.expires_at,
      createdAt: data.created_at,
    });
  });

  // List API keys for the current user
  fastify.get('/tokens', async (req, reply) => {
    const { data, error } = await supabase
      .from('api_keys')
      .select('id, name, key_prefix, last_used_at, expires_at, created_at')
      .eq('user_id', req.userId)
      .order('created_at', { ascending: false });

    if (error) return reply.status(500).send({ error: error.message });
    return data;
  });

  // Delete an API key
  fastify.delete<{ Params: { id: string } }>('/tokens/:id', async (req, reply) => {
    const { error } = await supabase
      .from('api_keys')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.userId);

    if (error) return reply.status(500).send({ error: error.message });
    return reply.status(204).send();
  });
}
