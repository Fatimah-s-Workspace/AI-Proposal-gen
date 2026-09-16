/**
 * The brand teal, matching `--primary` in the app.
 *
 * Written out rather than read from the theme because email has no CSS
 * variables: every colour has to be a literal in an inline style.
 */
const BRAND = "#0F6B64";

/**
 * The one call to action, so the four emails that have one cannot drift apart.
 *
 * `display: inline-block` is what makes the padding hold - several clients
 * drop padding on a plain inline anchor and the button collapses to bare
 * underlined text. White on this teal is 6.35:1, past AA for the 14px label.
 */
function button(href: string, label: string) {
  return `<a href="${href}" style="display: inline-block; background: ${BRAND}; color: #ffffff; padding: 12px 22px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 600;">${label}</a>`;
}

/**
 * Where the logo is fetched from.
 *
 * Mail clients render the HTML outside the app, so a relative path resolves
 * against the client's own domain and 404s. The URL has to be absolute, and
 * it has to be reachable from the public internet: in local development this
 * points at localhost, so the mark will show as alt text in a real inbox
 * until NEXT_PUBLIC_APP_URL is a deployed origin.
 */
function logoUrl() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${baseUrl.replace(/\/$/, "")}/brand/mark-128.png`;
}

function wrapper(title: string, bodyHtml: string) {
  return `<!doctype html>
<html>
  <body style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; background: #f4f4f5; padding: 24px;">
    <div style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 8px; padding: 32px;">
      <!--
        The lockup is an image plus real text, not one image.

        Most mail clients block remote images until the reader allows them, and
        a lone <img> with fixed width and height leaves a 32px empty box with
        its alt text clipped out of sight - the email opens with a blank
        header. With the wordmark as HTML the brand still reads when the mark
        does not load, and the mark is then decorative, so alt is empty rather
        than repeating the words next to it.

        Laid out as a table because Outlook ignores flex and inline-block
        vertical alignment. The image is served at 128px and displayed at 32 so
        it stays sharp on high-density screens, with width and height as
        attributes because Outlook ignores the CSS and would otherwise lay it
        out at its full size.
      -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 20px;">
        <tr>
          <td style="padding-right: 10px; vertical-align: middle;">
            <img src="${logoUrl()}" alt="" width="32" height="32"
                 style="display: block; width: 32px; height: 32px; border: 0;" />
          </td>
          <td style="vertical-align: middle; font-size: 16px; font-weight: 600; color: #0b1220;">
            TenderFlow <span style="font-weight: 400; color: #5a6b78;">AI</span>
          </td>
        </tr>
      </table>
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
       ${button(resetUrl, "Reset password")}
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

/**
 * Sent when someone tries to sign up with an address that already has an
 * account.
 *
 * Signup cannot say "that address is taken" without becoming a way to test
 * which addresses are registered, so the answer goes to the one person
 * entitled to it: the owner of the address. It doubles as a warning - if they
 * did not just try to sign up, someone else did, and knowing that is worth
 * more than the tidier signup form we gave up to tell them.
 */
export function duplicateSignupEmail(signInUrl: string, resetUrl: string) {
  const subject = "You already have a TenderFlow AI account";
  const text = `Someone just tried to create a TenderFlow AI account with this email address, and one already exists.

If that was you, sign in instead: ${signInUrl}

If you've forgotten your password, you can reset it: ${resetUrl}

If it wasn't you, no account was created and nothing has changed. You don't need to do anything, though it's worth making sure your password is one you don't use anywhere else.`;

  const html = wrapper(
    subject,
    `<p style="font-size: 14px; color: #3f3f46;">Someone just tried to create a TenderFlow AI account with this email address, and one already exists.</p>
     <p style="font-size: 14px; color: #3f3f46;">If that was you, sign in instead.</p>
     <p style="margin: 24px 0;">
       ${button(signInUrl, "Sign in")}
     </p>
     <p style="font-size: 14px; color: #3f3f46;">Forgotten your password? <a href="${resetUrl}" style="color: ${BRAND};">Reset it here</a>.</p>
     <p style="font-size: 12px; color: #71717a;">If it wasn't you, no account was created and nothing has changed. You don't need to do anything, though it's worth making sure your password is one you don't use anywhere else.</p>`,
  );

  return { subject, text, html };
}

export function verifyEmailEmail(verifyUrl: string) {
  const subject = "Confirm your TenderFlow AI email address";
  const text = `Confirm your email address to finish setting up your TenderFlow AI account (link valid for 24 hours): ${verifyUrl}\n\nIf you didn't create an account, you can safely ignore this email.`;
  const html = wrapper(
    subject,
    `<p style="font-size: 14px; color: #3f3f46;">Confirm your email address to finish setting up your account. This link is valid for 24 hours.</p>
     <p style="margin: 24px 0;">
       ${button(verifyUrl, "Confirm email address")}
     </p>
     <p style="font-size: 12px; color: #71717a;">If you didn't create an account, you can safely ignore this email.</p>`,
  );
  return { subject, text, html };
}

export function teamInviteEmail(inviterName: string, orgName: string, inviteUrl: string) {
  const subject = `${inviterName} invited you to join ${orgName} on TenderFlow AI`;
  const text = `${inviterName} invited you to join "${orgName}" on TenderFlow AI. Accept the invite (valid for 7 days): ${inviteUrl}\n\nIf you weren't expecting this, you can safely ignore this email.`;
  const html = wrapper(
    subject,
    `<p style="font-size: 14px; color: #3f3f46;">${inviterName} invited you to join <strong>${orgName}</strong> on TenderFlow AI. This link is valid for 7 days.</p>
     <p style="margin: 24px 0;">
       ${button(inviteUrl, "Accept invite")}
     </p>
     <p style="font-size: 12px; color: #71717a;">If you weren't expecting this, you can safely ignore this email.</p>`,
  );
  return { subject, text, html };
}

/**
 * Sent with the invoice attached when a payment succeeds.
 *
 * The invoice is attached rather than linked because the person who needs it
 * is usually not the person who paid - it gets forwarded to whoever does the
 * books, and a link behind a login is useless to them.
 */
export function invoiceEmail(input: {
  invoiceNumber: string;
  amount: string;
  planName: string;
  billingUrl: string;
}) {
  const subject = `Your TenderFlow AI invoice ${input.invoiceNumber}`;
  const text = `Thanks for your payment. Your ${input.planName} plan is active.

Invoice ${input.invoiceNumber} for ${input.amount} is attached to this email.

You can download this and any earlier invoice at any time: ${input.billingUrl}`;

  const html = wrapper(
    subject,
    `<p style="font-size: 14px; color: #3f3f46;">Thanks for your payment. Your <strong>${input.planName}</strong> plan is active.</p>
     <p style="font-size: 14px; color: #3f3f46;">Invoice <strong>${input.invoiceNumber}</strong> for <strong>${input.amount}</strong> is attached to this email.</p>
     <p style="margin: 24px 0;">
       ${button(input.billingUrl, "View your invoices")}
     </p>
     <p style="font-size: 12px; color: #71717a;">You can download this and any earlier invoice at any time from your billing settings.</p>`,
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
       ${button(billingUrl, "Renew Pro plan")}
     </p>
     <p style="font-size: 12px; color: #71717a;">If you don't renew, your account reverts to the Starter plan's limits when it expires - your data and projects are unaffected.</p>`,
  );
  return { subject, text, html };
}
