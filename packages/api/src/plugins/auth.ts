import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import bcrypt from 'bcryptjs';
import { supabase } from '../lib/supabase.js';

declare module 'fastify' {
  interface FastifyRequest {
    userId: string;
    userEmail: string;
    isAdmin: boolean;
  }
}

async function authPluginFn(fastify: FastifyInstance) {
  fastify.decorateRequest('userId', '');
  fastify.decorateRequest('userEmail', '');
  fastify.decorateRequest('isAdmin', false);

  fastify.addHook('preHandler', async (req: FastifyRequest, reply: FastifyReply) => {
    // Skip auth for health, stripe webhooks, and worker pings with service tokens
    if (req.url === '/health' || req.url.startsWith('/webhooks/stripe')) return;

    // Worker service token auth
    if (req.url.startsWith('/workers/')) {
      const serviceTokenId = req.headers['cf-access-client-id'] as string;
      const serviceTokenSecret = req.headers['cf-access-client-secret'] as string;
      if (
        serviceTokenId === process.env.CF_SERVICE_TOKEN_ID &&
        serviceTokenSecret === process.env.CF_SERVICE_TOKEN_SECRET
      ) {
        return; // worker authenticated
      }
      // In dev mode, allow without service tokens
      if (process.env.NODE_ENV === 'development') return;
      return reply.status(401).send({ error: 'Invalid service token' });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return reply.status(401).send({ error: 'Missing authorization header' });
    }

    // API key auth: "Bearer forge_xxxx..."
    if (authHeader.startsWith('Bearer forge_')) {
      const apiKey = authHeader.slice(7);
      const prefix = apiKey.slice(0, 8);

      const { data: keys } = await supabase
        .from('api_keys')
        .select('*')
        .eq('key_prefix', prefix);

      if (!keys?.length) {
        return reply.status(401).send({ error: 'Invalid API key' });
      }

      for (const key of keys) {
        if (await bcrypt.compare(apiKey, key.key_hash)) {
          if (key.expires_at && new Date(key.expires_at) < new Date()) {
            return reply.status(401).send({ error: 'API key expired' });
          }

          // Update last used
          await supabase
            .from('api_keys')
            .update({ last_used_at: new Date().toISOString() })
            .eq('id', key.id);

          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', key.user_id)
            .single();

          if (!profile) {
            return reply.status(401).send({ error: 'User not found' });
          }

          req.userId = profile.id;
          req.userEmail = profile.email;
          req.isAdmin = profile.is_admin;
          return;
        }
      }

      return reply.status(401).send({ error: 'Invalid API key' });
    }

    // JWT auth: "Bearer eyJ..."
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return reply.status(401).send({ error: 'Invalid token' });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return reply.status(401).send({ error: 'Profile not found' });
    }

    req.userId = user.id;
    req.userEmail = profile.email;
    req.isAdmin = profile.is_admin;
  });
}

export const authPlugin = fp(authPluginFn, { name: 'auth' });
