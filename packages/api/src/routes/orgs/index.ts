import type { FastifyInstance } from 'fastify';
import { supabase } from '../../lib/supabase.js';
import { stripe } from '../../lib/stripe.js';
import { createOrgSchema } from '@forge/shared';

export async function orgRoutes(fastify: FastifyInstance) {
  // Create org
  fastify.post('/', async (req, reply) => {
    const body = createOrgSchema.parse(req.body);

    // Create Stripe customer if Stripe is configured
    let stripeCustomerId: string | null = null;
    if (stripe) {
      const customer = await stripe.customers.create({
        email: req.userEmail,
        name: body.name,
        metadata: { slug: body.slug },
      });
      stripeCustomerId = customer.id;
    }

    const { data: org, error } = await supabase
      .from('organizations')
      .insert({
        name: body.name,
        slug: body.slug,
        stripe_customer_id: stripeCustomerId,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return reply.status(409).send({ error: 'Slug already taken' });
      }
      return reply.status(500).send({ error: error.message });
    }

    // Add creator as owner
    await supabase.from('org_members').insert({
      org_id: org.id,
      user_id: req.userId,
      role: 'owner',
    });

    return reply.status(201).send(org);
  });

  // List user's orgs
  fastify.get('/', async (req, reply) => {
    const { data: memberships } = await supabase
      .from('org_members')
      .select('org_id, role')
      .eq('user_id', req.userId);

    if (!memberships?.length) return [];

    const orgIds = memberships.map((m) => m.org_id);
    const { data: orgs } = await supabase
      .from('organizations')
      .select('*')
      .in('id', orgIds)
      .order('created_at', { ascending: false });

    return orgs?.map((org) => ({
      ...org,
      role: memberships.find((m) => m.org_id === org.id)?.role,
    })) ?? [];
  });

  // Get org by slug
  fastify.get<{ Params: { slug: string } }>('/:slug', async (req, reply) => {
    if (!req.org) return reply.status(404).send({ error: 'Not found' });
    return req.org;
  });

  // Update org
  fastify.patch<{ Params: { slug: string }; Body: { name?: string } }>(
    '/:slug',
    async (req, reply) => {
      if (!req.org) return reply.status(404).send({ error: 'Not found' });

      // Check owner role
      const { data: membership } = await supabase
        .from('org_members')
        .select('role')
        .eq('org_id', req.org.id)
        .eq('user_id', req.userId)
        .single();

      if (membership?.role !== 'owner' && !req.isAdmin) {
        return reply.status(403).send({ error: 'Only owners can update org settings' });
      }

      const updates: Record<string, unknown> = {};
      if ((req.body as any).name) updates.name = (req.body as any).name;

      const { data, error } = await supabase
        .from('organizations')
        .update(updates)
        .eq('id', req.org.id)
        .select()
        .single();

      if (error) return reply.status(500).send({ error: error.message });
      return data;
    },
  );
}
