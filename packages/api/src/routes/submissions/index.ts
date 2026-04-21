import type { FastifyInstance } from 'fastify';
import { supabase } from '../../lib/supabase.js';
import { enqueueSubmission } from '../../queue/producer.js';
import { createSubmissionSchema } from '@forge/shared';

export async function submissionRoutes(fastify: FastifyInstance) {
  // Create submission
  fastify.post<{ Params: { slug: string } }>('/:slug/submissions', async (req, reply) => {
    if (!req.org) return reply.status(404).send({ error: 'Not found' });

    const body = createSubmissionSchema.parse(req.body);

    // Verify build exists and is successful
    const { data: build } = await supabase
      .from('builds')
      .select('*')
      .eq('id', body.buildId)
      .eq('org_id', req.org.id)
      .single();

    if (!build) return reply.status(404).send({ error: 'Build not found' });
    if (build.status !== 'success') {
      return reply.status(400).send({ error: 'Build must be successful to submit' });
    }

    const { data: submission, error } = await supabase
      .from('submissions')
      .insert({
        org_id: req.org.id,
        user_id: req.userId,
        build_id: body.buildId,
        platform: body.platform,
        track: body.track,
        credential_id: body.credentialId,
        asc_app_id: body.ascAppId,
        android_package: body.androidPackage,
      })
      .select()
      .single();

    if (error) return reply.status(500).send({ error: error.message });

    await enqueueSubmission(submission.id, req.org.id, body.platform);
    return reply.status(201).send(submission);
  });

  // List submissions
  fastify.get<{ Params: { slug: string } }>('/:slug/submissions', async (req, reply) => {
    if (!req.org) return reply.status(404).send({ error: 'Not found' });

    const { data, error } = await supabase
      .from('submissions')
      .select('*')
      .eq('org_id', req.org.id)
      .order('created_at', { ascending: false });

    if (error) return reply.status(500).send({ error: error.message });
    return data;
  });

  // Get submission
  fastify.get<{ Params: { slug: string; id: string } }>(
    '/:slug/submissions/:id',
    async (req, reply) => {
      if (!req.org) return reply.status(404).send({ error: 'Not found' });

      const { data, error } = await supabase
        .from('submissions')
        .select('*')
        .eq('id', req.params.id)
        .eq('org_id', req.org.id)
        .single();

      if (error || !data) return reply.status(404).send({ error: 'Submission not found' });
      return data;
    },
  );

  // Cancel submission
  fastify.delete<{ Params: { slug: string; id: string } }>(
    '/:slug/submissions/:id',
    async (req, reply) => {
      if (!req.org) return reply.status(404).send({ error: 'Not found' });

      const { data, error } = await supabase
        .from('submissions')
        .update({ status: 'failed', error_message: 'Cancelled by user', finished_at: new Date().toISOString() })
        .eq('id', req.params.id)
        .eq('org_id', req.org.id)
        .in('status', ['queued'])
        .select()
        .single();

      if (error || !data) return reply.status(400).send({ error: 'Cannot cancel this submission' });
      return data;
    },
  );
}
