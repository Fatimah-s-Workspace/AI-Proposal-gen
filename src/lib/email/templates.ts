function wrapper(title: string, bodyHtml: string) {
  return `<!doctype html>
<html>
  <body style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; background: #f4f4f5; padding: 24px;">
    <div style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 8px; padding: 32px;">
      <h1 style="font-size: 18px; margin: 0 0 16px;">${title}</h1>
      ${bodyHtml}
      <p style="margin-top: 32px; font-size: 12px; color: #71717a;">TenderFlow AI</p>
    </div>
  </body>
</html>`;
}

export function resetPasswordEmail(resetUrl: string) {
  const subject = "Reset your TenderFlow AI password";
  const text = `Reset your password by visiting this link (valid for 1 hour): ${resetUrl}\n\nIf you didn't request this, you can safely ignore this email.`;
  const html = wrapper(
    subject,
    `<p style="font-size: 14px; color: #3f3f46;">We received a request to reset your password. This link is valid for 1 hour.</p>
     <p style="margin: 24px 0;">
       <a href="${resetUrl}" style="background: #18181b; color: #ffffff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 14px;">Reset password</a>
     </p>
     <p style="font-size: 12px; color: #71717a;">If you didn't request this, you can safely ignore this email.</p>`,
  );
  return { subject, text, html };
}

export function welcomeEmail(name: string) {
  const subject = "Welcome to TenderFlow AI";
  const text = `Hi ${name},\n\nYour TenderFlow AI account is ready. Start a new project to analyze tender documents and generate proposal drafts.`;
  const html = wrapper(
    subject,
    `<p style="font-size: 14px; color: #3f3f46;">Hi ${name},</p>
     <p style="font-size: 14px; color: #3f3f46;">Your account is ready. Start a new project to analyze tender documents and generate proposal drafts.</p>`,
  );
  return { subject, text, html };
}

export function renewalReminderEmail(daysRemaining: number, billingUrl: string) {
  const subject =
    daysRemaining <= 0
      ? "Your TenderFlow AI Pro plan expires today"
      : `Your TenderFlow AI Pro plan expires in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}`;
  const text = `${subject}. Renew now to keep your Pro upload and AI generation limits: ${billingUrl}\n\nIf you don't renew, your account reverts to the Starter plan's limits when it expires - your data and projects are unaffected.`;
  const html = wrapper(
    subject,
    `<p style="font-size: 14px; color: #3f3f46;">Renew now to keep your Pro upload and AI generation limits.</p>
     <p style="margin: 24px 0;">
       <a href="${billingUrl}" style="background: #18181b; color: #ffffff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 14px;">Renew Pro plan</a>
     </p>
     <p style="font-size: 12px; color: #71717a;">If you don't renew, your account reverts to the Starter plan's limits when it expires - your data and projects are unaffected.</p>`,
  );
  return { subject, text, html };
}
