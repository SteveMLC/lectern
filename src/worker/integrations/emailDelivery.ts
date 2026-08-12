import type { Env } from "../env";

export interface EmailDeliveryRequest {
  messageId: string;
  toEmail: string;
  subject: string;
  bodyMd: string;
}

export interface EmailDeliveryResult {
  mode: "simulated" | "resend";
  status: "success" | "failure";
  messageStatus: "sent_simulated" | "sent" | "failed";
  providerId: string | null;
  error: string | null;
}

export interface EmailDelivery {
  send(input: EmailDeliveryRequest): Promise<EmailDeliveryResult>;
}

interface ResendResponse {
  id?: unknown;
  message?: unknown;
  name?: unknown;
}

const simulatedResult = (): EmailDeliveryResult => ({
  mode: "simulated",
  status: "success",
  messageStatus: "sent_simulated",
  providerId: null,
  error: null,
});

function failure(error: string): EmailDeliveryResult {
  return {
    mode: "resend",
    status: "failure",
    messageStatus: "failed",
    providerId: null,
    error,
  };
}

/**
 * Cloudflare-native Resend transport. Delivery is fail-closed: a key by itself
 * can never send mail; EMAIL_DELIVERY_MODE must be "resend" and a verified
 * sender must also be configured. Disabled environments retain the existing
 * simulated outbox behavior.
 */
export function createEmailDelivery(
  env: Pick<Env, "EMAIL_DELIVERY_MODE" | "RESEND_API_KEY" | "RESEND_FROM_EMAIL" | "EMAIL_DELIVERY_ALLOWLIST">,
  fetcher: typeof fetch = globalThis.fetch.bind(globalThis),
): EmailDelivery {
  if (env.EMAIL_DELIVERY_MODE !== "resend") {
    return { send: async () => simulatedResult() };
  }

  return {
    async send(input) {
      const allowed = (env.EMAIL_DELIVERY_ALLOWLIST ?? "")
        .split(",")
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean);
      if (allowed.length > 0 && !allowed.includes(input.toEmail.toLowerCase())) {
        return simulatedResult();
      }
      if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) {
        return failure("Resend delivery is enabled but its API key or verified sender is missing.");
      }

      try {
        const response = await fetcher("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            authorization: `Bearer ${env.RESEND_API_KEY}`,
            "content-type": "application/json",
            "idempotency-key": `speakerops/${input.messageId}`,
          },
          body: JSON.stringify({
            from: env.RESEND_FROM_EMAIL,
            to: [input.toEmail],
            subject: input.subject,
            text: input.bodyMd,
          }),
        });
        const payload = await response.json().catch(() => ({})) as ResendResponse;
        if (!response.ok) {
          const reason = typeof payload.message === "string" ? payload.message : `HTTP ${response.status}`;
          return failure(`Resend rejected the message: ${reason}`);
        }
        if (typeof payload.id !== "string" || !payload.id) {
          return failure("Resend accepted the request without returning a provider message ID.");
        }
        return {
          mode: "resend",
          status: "success",
          messageStatus: "sent",
          providerId: payload.id,
          error: null,
        };
      } catch (caught) {
        const reason = caught instanceof Error ? caught.message : "Unknown network error";
        return failure(`Resend request failed: ${reason}`);
      }
    },
  };
}
