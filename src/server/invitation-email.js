import { createHash } from 'node:crypto';
import { sendEmail } from './email.js';

export const invitationEmailMessages = {
  accepted: 'Email accepted by the provider. Inbox delivery is not confirmed.',
  anonymous: 'Anonymous profile: share the link manually.',
  no_email: 'No email address on this profile: share the link manually.',
  inactive: 'Inactive profile: no email was attempted.',
  not_configured: 'Email is not configured. Share the link manually.',
  invalid_input: 'Email details are invalid. Share the link manually and check the profile.',
  provider_rejected: 'The provider rejected the email. Share the link manually. The test sender can only reach the Resend account email address.',
  send_unconfirmed: 'Email sending could not be confirmed; it may have been accepted. You can share this same link manually.',
};

// Called only after invitation creation commits. Never let an email failure hide
// the valid link or encourage retrying the database transaction.
export async function emailInvitation({ expert, token, title, origin }, send = sendEmail) {
  if (!expert?.active) return 'inactive';
  if (expert.profile_mode !== 'named') return 'anonymous';
  if (!expert.email) return 'no_email';
  try {
    const link = new URL('/invite', origin);
    link.searchParams.set('token', token);
    await send({
      to: expert.email,
      subject: 'Your Ground Truth questionnaire invitation',
      text: `You are invited to contribute to Ground Truth: ${title}\n\nOpen your questionnaire:\n${link.href}\n\nThis private link works once and expires in 48 hours. Open it and confirm to continue. Please do not forward it. Your saved progress and existing valid sessions are preserved.\n\nIf you were not expecting this invitation, you can ignore this email.`,
      // Distinguish each newly generated invitation without exposing its token
      // or the expert's identity in provider metadata.
      idempotencyKey: `invitation-${createHash('sha256').update(token).digest('hex')}`,
    });
    return 'accepted';
  } catch (error) {
    return ['not_configured', 'invalid_input', 'provider_rejected'].includes(error?.code)
      ? error.code : 'send_unconfirmed';
  }
}
