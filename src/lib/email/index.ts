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
  | { delivered: false; reason: "no_api_key" | "send_failed" };

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.BREVO_API_KEY?.trim();
  if (!apiKey) {
    console.log(`[email:dev] Would send to ${input.to}: ${input.subject}\n${input.text}`);
    return { delivered: false, reason: "no_api_key" };
  }

  const response = await fetch(BREVO_SEND_URL, {
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
  });

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
