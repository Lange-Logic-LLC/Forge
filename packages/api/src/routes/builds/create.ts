import type { FastifyInstance } from 'fastify';
import crypto from 'crypto';
import { supabase } from '../../lib/supabase.js';
import { enqueueBuild } from '../../queue/producer.js';
import { checkBuildLimits } from '../../queue/planLimits.js';
import { createBuildSchema } from '@forge/shared';

export async function buildRoutes(fastify: FastifyInstance) {
  // Generate a presigned upload URL for project source
  fastify.post<{ Params: { slug: string } }>('/:slug/builds/upload-url', async (req, reply) => {
    if (!req.org) return reply.status(404).send({ error: 'Not found' });

    const fileId = crypto.randomUUID();
    const storagePath = `${req.org.id}/sources/${fileId}.zip`;

    const { data, error } = await supabase.storage
      .from('build-artifacts')
      .createSignedUploadUrl(storagePath);

    if (error) return reply.status(500).send({ error: error.message });

    // Build the download URL for the worker to fetch later
    const { data: downloadData } = await supabase.storage
      .from('build-artifacts')
      .createSignedUrl(storagePath, 60 * 60 * 2); // 2 hour expiry

    return {
      uploadUrl: data.signedUrl,
      sourceUrl: downloadData?.signedUrl ?? storagePath,
      token: data.token,
    };
  });

  fastify.post<{ Params: { slug: string } }>('/:slug/builds', async (req, reply) => {
    if (!req.org) return reply.status(404).send({ error: 'Not found' });

    const body = createBuildSchema.parse(req.body);

    // Check plan limits
    const { allowed, error: limitError } = await checkBuildLimits(req.org);
    if (!allowed) {
      return reply.status(429).send({
        error: limitError,
        limit: req.org.builds_limit,
        used: req.org.builds_used_this_month,
      });
    }

    // Create build record
    const { data: build, error } = await supabase
      .from('builds')
      .insert({
        org_id: req.org.id,
        user_id: req.userId,
        platform: body.platform,
        profile: body.profile,
        git_url: body.gitUrl,
        git_ref: body.gitRef,
        source_url: body.sourceUrl,
        metadata: {
          ...body.metadata,
          autoSubmit: body.autoSubmit,
          submitTrack: body.submitTrack,
          submitCredentialId: body.submitCredentialId,
          ascAppId: body.ascAppId,
          androidPackage: body.androidPackage,
          credentialId: body.credentialId,
        },
      })
      .select()
      .single();

    if (error) return reply.status(500).send({ error: error.message });

    // Enqueue to the correct platform queue
    await enqueueBuild(build.id, req.org.id, body.platform, req.org.plan);

    return reply.status(201).send(build);
  });
}
