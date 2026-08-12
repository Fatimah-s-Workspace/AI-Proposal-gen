import { captureError } from "@/lib/monitoring";

const BREVO_SEND_URL = "https://api.brevo.com/v3/smtp/emails";

export function hasBrevoApiKey() {
  return Boolean(process.env.BREVO_API_KEY?.trim());
}

function fromAddress() {
  return process.env.EMAIL_FROM?.trim() || "TenderFlow AI <no-reply@example.com>";
}

// EMAIL_FROM is stored as "Name <email>" for readability elsewhere (e.g. a
// future SMTP fallback), but Brevo's API wants sender name/email as separate
// fields.
function parseFromAddress(from: string) {
  const match = from.match(/^(.*?)\s*<([^>]+)>$/);
  if (match) {
    return { name: match[1].trim() || undefined, email: match[2].trim() };
  }
  return { email: from.trim() };
}

type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

type SendEmailResult =
  | { delivered: true }
  | { delivered: false; reason: "no_api_key" | "send_failed" | "unreachable" };

// Brevo is a third party on the far side of the network, and nothing here is
// worth blocking a user's signup on for longer than this. Without a deadline
// the fetch inherits Node's, which is effectively "forever" - a hung provider
// then holds the request open until something upstream gives up.
const SEND_TIMEOUT_MS = 10_000;

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.BREVO_API_KEY?.trim();
  if (!apiKey) {
    console.log(`[email:dev] Would send to ${input.to}: ${input.subject}\n${input.text}`);
    return { delivered: false, reason: "no_api_key" };
  }

  let response: Response;
  try {
    response = await fetch(BREVO_SEND_URL, {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        sender: parseFromAddress(fromAddress()),
        to: [{ email: input.to }],
        subject: input.subject,
        htmlContent: input.html,
        textContent: input.text,
      }),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
  } catch (error) {
    // A refused, hung, or aborted request threw straight out of here before,
    // past every caller that was written against the result type below. The
    // callers all treat email as best-effort, so the only thing that ever
    // achieved was turning an undelivered email into a failed signup.
    captureError(error, { to: input.to, subject: input.subject, stage: "brevo_fetch" });
    return { delivered: false, reason: "unreachable" };
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    captureError(new Error(`Brevo send failed: ${body.message ?? response.statusText}`), {
      to: input.to,
      subject: input.subject,
      status: response.status,
      code: body.code,
    });
    return { delivered: false, reason: "send_failed" };
  }

  return { delivered: true };
}
