import { createHmac } from "crypto";
import { captureError } from "@/lib/monitoring";

const PAYSTACK_BASE_URL = "https://api.paystack.co";

export function hasPaystackKey() {
  return Boolean(process.env.PAYSTACK_SECRET_KEY?.trim());
}

function secretKey() {
  return process.env.PAYSTACK_SECRET_KEY?.trim();
}

type InitializeTransactionInput = {
  email: string;
  amountKobo: number;
  reference: string;
  callbackUrl: string;
  metadata?: Record<string, unknown>;
};

type InitializeTransactionResult =
  | { ok: true; authorizationUrl: string }
  | { ok: false; reason: "no_api_key" | "request_failed" };

export async function initializeTransaction(
  input: InitializeTransactionInput,
): Promise<InitializeTransactionResult> {
  const key = secretKey();
  if (!key) return { ok: false, reason: "no_api_key" };

  let response: Response;
  try {
    response = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: input.email,
        amount: input.amountKobo,
        reference: input.reference,
        callback_url: input.callbackUrl,
        metadata: input.metadata,
      }),
    });
  } catch (error) {
    captureError(error, { route: "paystack:initialize", reference: input.reference });
    return { ok: false, reason: "request_failed" };
  }

  const body = await response.json().catch(() => null);
  const authorizationUrl = body?.data?.authorization_url;

  if (!response.ok || !body?.status || typeof authorizationUrl !== "string") {
    captureError(new Error(`Paystack initialize failed: ${body?.message ?? response.statusText}`), {
      reference: input.reference,
      status: response.status,
    });
    return { ok: false, reason: "request_failed" };
  }

  return { ok: true, authorizationUrl };
}

type VerifyTransactionResult =
  | {
      ok: true;
      status: string;
      amountKobo: number;
      currency: string;
      reference: string;
      paidAt: string | null;
    }
  | { ok: false; reason: "no_api_key" | "request_failed" };

export async function verifyTransaction(reference: string): Promise<VerifyTransactionResult> {
  const key = secretKey();
  if (!key) return { ok: false, reason: "no_api_key" };

  let response: Response;
  try {
    response = await fetch(
      `${PAYSTACK_BASE_URL}/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${key}` } },
    );
  } catch (error) {
    captureError(error, { route: "paystack:verify", reference });
    return { ok: false, reason: "request_failed" };
  }

  const body = await response.json().catch(() => null);

  if (!response.ok || !body?.status || !body.data) {
    captureError(new Error(`Paystack verify failed: ${body?.message ?? response.statusText}`), {
      reference,
      status: response.status,
    });
    return { ok: false, reason: "request_failed" };
  }

  return {
    ok: true,
    status: body.data.status,
    amountKobo: body.data.amount,
    currency: body.data.currency,
    reference: body.data.reference,
    paidAt: body.data.paid_at ?? null,
  };
}

// Paystack signs webhook payloads with HMAC-SHA512 of the raw request body
// using the secret key, sent in the x-paystack-signature header. Verifying
// this is what makes the webhook trustworthy - without it, anyone who finds
// the endpoint URL could POST a fake "payment succeeded" event.
export function verifyWebhookSignature(rawBody: string, signature: string | null) {
  const key = secretKey();
  if (!key || !signature) return false;

  const hash = createHmac("sha512", key).update(rawBody).digest("hex");
  return hash === signature;
}
