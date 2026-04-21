import type { FastifyInstance } from 'fastify';
import { supabase } from '../../lib/supabase.js';

export async function memberRoutes(fastify: FastifyInstance) {
  // List members
  fastify.get<{ Params: { slug: string } }>('/:slug/members', async (req, reply) => {
    if (!req.org) return reply.status(404).send({ error: 'Not found' });

    const { data, error } = await supabase
      .from('org_members')
      .select(`
        user_id,
        role,
        joined_at,
        profiles (id, email, display_name, avatar_url)
      `)
      .eq('org_id', req.org.id);

    if (error) return reply.status(500).send({ error: error.message });
    return data;
  });

  // Remove member
  fastify.delete<{ Params: { slug: string; userId: string } }>(
    '/:slug/members/:userId',
    async (req, reply) => {
      if (!req.org) return reply.status(404).send({ error: 'Not found' });

      // Check caller is admin/owner
      const { data: callerMembership } = await supabase
        .from('org_members')
        .select('role')
        .eq('org_id', req.org.id)
        .eq('user_id', req.userId)
        .single();

      if (!callerMembership || !['owner', 'admin'].includes(callerMembership.role)) {
        return reply.status(403).send({ error: 'Insufficient permissions' });
      }

      // Can't remove the last owner
      if (req.params.userId === req.userId) {
        const { count } = await supabase
          .from('org_members')
          .select('*', { count: 'exact', head: true })
          .eq('org_id', req.org.id)
          .eq('role', 'owner');

        if ((count ?? 0) <= 1 && callerMembership.role === 'owner') {
          return reply.status(400).send({ error: 'Cannot remove the last owner' });
        }
      }

      const { error } = await supabase
        .from('org_members')
        .delete()
        .eq('org_id', req.org.id)
        .eq('user_id', req.params.userId);

      if (error) return reply.status(500).send({ error: error.message });
      return reply.status(204).send();
    },
  );
}
