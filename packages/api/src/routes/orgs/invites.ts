import type { FastifyInstance } from 'fastify';
import { supabase } from '../../lib/supabase.js';
import { sendEmail } from '../../lib/email.js';
import { inviteMemberSchema } from '@forge/shared';

export async function inviteRoutes(fastify: FastifyInstance) {
  // Send invite
  fastify.post<{ Params: { slug: string } }>('/:slug/invites', async (req, reply) => {
    if (!req.org) return reply.status(404).send({ error: 'Not found' });

    const body = inviteMemberSchema.parse(req.body);

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

    // Check if already a member
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', body.email)
      .single();

    if (existingProfile) {
      const { data: existingMember } = await supabase
        .from('org_members')
        .select('user_id')
        .eq('org_id', req.org.id)
        .eq('user_id', existingProfile.id)
        .single();

      if (existingMember) {
        return reply.status(409).send({ error: 'User is already a member' });
      }
    }

    const { data: invite, error } = await supabase
      .from('org_invites')
      .insert({
        org_id: req.org.id,
        email: body.email,
        role: body.role,
        invited_by: req.userId,
      })
      .select()
      .single();

    if (error) return reply.status(500).send({ error: error.message });

    // Send invite email
    const acceptUrl = `${process.env.DASHBOARD_URL ?? 'http://localhost:3001'}/invites/${invite.token}`;
    await sendEmail(
      body.email,
      `You've been invited to ${req.org.name} on Forge`,
      `<p>You've been invited to join <strong>${req.org.name}</strong> as a ${body.role}.</p>
       <p><a href="${acceptUrl}">Accept Invite</a></p>
       <p>This invite expires in 7 days.</p>`,
    );

    return reply.status(201).send(invite);
  });

  // Accept invite (public route — token-based auth)
  fastify.post<{ Params: { token: string } }>('/invites/:token/accept', async (req, reply) => {
    const { data: invite } = await supabase
      .from('org_invites')
      .select('*')
      .eq('token', req.params.token)
      .is('accepted_at', null)
      .single();

    if (!invite) {
      return reply.status(404).send({ error: 'Invite not found or already accepted' });
    }

    if (new Date(invite.expires_at) < new Date()) {
      return reply.status(410).send({ error: 'Invite has expired' });
    }

    // Add user to org
    await supabase.from('org_members').insert({
      org_id: invite.org_id,
      user_id: req.userId,
      role: invite.role,
      invited_by: invite.invited_by,
    });

    // Mark invite accepted
    await supabase
      .from('org_invites')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', invite.id);

    return { message: 'Invite accepted' };
  });
}
