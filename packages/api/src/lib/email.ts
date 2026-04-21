// Email utility — uses Resend when configured, logs to console otherwise
export async function sendEmail(to: string, subject: string, html: string) {
  if (process.env.RESEND_API_KEY) {
    const { Resend } = await import('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: process.env.EMAIL_FROM ?? 'Forge Builds <builds@localhost>',
      to,
      subject,
      html,
    });
  } else {
    console.log(`[EMAIL] To: ${to} | Subject: ${subject}`);
  }
}
