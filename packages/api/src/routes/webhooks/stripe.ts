import type { FastifyInstance } from 'fastify';
import { supabase } from '../../lib/supabase.js';
import { stripe, getPlanFromPriceId, getPlanConfig } from '../../lib/stripe.js';

export async function stripeWebhookRoutes(fastify: FastifyInstance) {
  // Store raw body for Stripe signature verification
  fastify.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (req, body, done) => {
      (req as any).rawBody = body;
      try {
        done(null, JSON.parse(body.toString()));
      } catch (err) {
        done(err as Error, undefined);
      }
    },
  );

  fastify.post('/webhooks/stripe', async (req, reply) => {
    if (!stripe) {
      return reply.status(503).send({ error: 'Stripe not configured' });
    }

    const sig = req.headers['stripe-signature'] as string;
    if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
      return reply.status(400).send({ error: 'Missing signature' });
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(
        (req as any).rawBody ?? JSON.stringify(req.body),
        sig,
        process.env.STRIPE_WEBHOOK_SECRET,
      );
    } catch (err) {
      return reply.status(400).send({ error: 'Invalid signature' });
    }

    // Log event for audit
    const customerId = (event.data.object as any).customer;
    if (customerId) {
      const { data: org } = await supabase
        .from('organizations')
        .select('id')
        .eq('stripe_customer_id', customerId)
        .single();

      if (org) {
        await supabase.from('billing_events').insert({
          org_id: org.id,
          event_type: event.type,
          stripe_event_id: event.id,
          payload: event.data.object as any,
        });
      }
    }

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as any;
        const plan = getPlanFromPriceId(sub.items.data[0].price.id);
        const config = getPlanConfig(plan);

        await supabase
          .from('organizations')
          .update({
            plan,
            stripe_subscription_id: sub.id,
            builds_limit: config.buildsLimit,
            concurrent_limit: config.concurrentLimit,
            artifact_ttl_days: config.artifactTtlDays,
            is_active: sub.status === 'active',
          })
          .eq('stripe_customer_id', sub.customer);
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as any;
        const starterConfig = getPlanConfig('starter');
        await supabase
          .from('organizations')
          .update({
            plan: 'starter',
            builds_limit: starterConfig.buildsLimit,
            concurrent_limit: starterConfig.concurrentLimit,
            artifact_ttl_days: starterConfig.artifactTtlDays,
            is_active: true,
          })
          .eq('stripe_customer_id', sub.customer);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as any;
        await supabase
          .from('organizations')
          .update({ is_active: false })
          .eq('stripe_customer_id', invoice.customer);
        break;
      }
    }

    return { received: true };
  });
}
