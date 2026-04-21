import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { authPlugin } from './plugins/auth.js';
import { tenantPlugin } from './plugins/tenant.js';
import { authRoutes } from './routes/auth/token.js';
import { orgRoutes } from './routes/orgs/index.js';
import { memberRoutes } from './routes/orgs/members.js';
import { inviteRoutes } from './routes/orgs/invites.js';
import { buildRoutes } from './routes/builds/create.js';
import { buildListRoutes } from './routes/builds/list.js';
import { buildGetRoutes } from './routes/builds/get.js';
import { buildCancelRoutes } from './routes/builds/cancel.js';
import { buildLogRoutes } from './routes/builds/logs.js';
import { credentialRoutes } from './routes/credentials/crud.js';
import { webhookRoutes } from './routes/webhooks/crud.js';
import { stripeWebhookRoutes } from './routes/webhooks/stripe.js';
import { workerPingRoutes } from './routes/workers/ping.js';
import { adminOrgRoutes } from './routes/admin/orgs.js';
import { adminBuildRoutes } from './routes/admin/builds.js';
import { adminWorkerRoutes } from './routes/admin/workers.js';
import { submissionRoutes } from './routes/submissions/index.js';

const app = Fastify({
  logger: true,
  trustProxy: true,
});

async function start() {
  await app.register(cors, { origin: true });
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    redis: undefined, // uses in-memory by default; switch to Redis for multi-process
  });

  // Stripe webhook needs raw body — register before auth plugin
  await app.register(stripeWebhookRoutes);

  // Auth + tenant middleware
  await app.register(authPlugin);
  await app.register(tenantPlugin);

  // Routes
  await app.register(authRoutes, { prefix: '/auth' });
  await app.register(orgRoutes, { prefix: '/orgs' });
  await app.register(memberRoutes, { prefix: '/orgs' });
  await app.register(inviteRoutes, { prefix: '/orgs' });
  await app.register(buildRoutes, { prefix: '/orgs' });
  await app.register(buildListRoutes, { prefix: '/orgs' });
  await app.register(buildGetRoutes, { prefix: '/orgs' });
  await app.register(buildCancelRoutes, { prefix: '/orgs' });
  await app.register(buildLogRoutes, { prefix: '/orgs' });
  await app.register(credentialRoutes, { prefix: '/orgs' });
  await app.register(webhookRoutes, { prefix: '/orgs' });
  await app.register(submissionRoutes, { prefix: '/orgs' });
  await app.register(workerPingRoutes, { prefix: '/workers' });
  await app.register(adminOrgRoutes, { prefix: '/admin' });
  await app.register(adminBuildRoutes, { prefix: '/admin' });
  await app.register(adminWorkerRoutes, { prefix: '/admin' });

  // Health check
  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  const port = parseInt(process.env.PORT ?? '3000', 10);
  await app.listen({ port, host: '0.0.0.0' });
  console.log(`Forge API running on http://localhost:${port}`);
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
