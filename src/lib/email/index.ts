import { Resend } from "resend";
import { captureError } from "@/lib/monitoring";

let resendClient: Resend | null = null;

export function hasResendApiKey() {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

function getResendClient() {
  if (!hasResendApiKey()) return null;
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

function fromAddress() {
  return process.env.EMAIL_FROM?.trim() || "TenderFlow AI <onboarding@resend.dev>";
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
  const client = getResendClient();
  if (!client) {
    console.log(`[email:dev] Would send to ${input.to}: ${input.subject}\n${input.text}`);
    return { delivered: false, reason: "no_api_key" };
  }

  const { error } = await client.emails.send({
    from: fromAddress(),
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });

  if (error) {
    captureError(new Error(`Resend send failed: ${error.message}`), { to: input.to, subject: input.subject });
    return { delivered: false, reason: "send_failed" };
  }

  return { delivered: true };
}
