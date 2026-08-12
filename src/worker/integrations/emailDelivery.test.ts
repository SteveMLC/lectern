import { describe, expect, it, vi } from "vitest";
import { createEmailDelivery } from "./emailDelivery";

const message = {
  messageId: "msg_123",
  toEmail: "authorized@example.com",
  subject: "SpeakerOps delivery test",
  bodyMd: "This is a labeled transport test.",
};

describe("email delivery", () => {
  it("stays simulated unless real delivery is explicitly enabled", async () => {
    const fetcher = vi.fn();
    const result = await createEmailDelivery(
      { RESEND_API_KEY: "re_present_but_inert", RESEND_FROM_EMAIL: "SpeakerOps <updates@example.com>" },
      fetcher as unknown as typeof fetch,
    ).send(message);

    expect(result).toEqual({
      mode: "simulated",
      status: "success",
      messageStatus: "sent_simulated",
      providerId: null,
      error: null,
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("fails closed when enabled configuration is incomplete", async () => {
    const fetcher = vi.fn();
    const result = await createEmailDelivery(
      { EMAIL_DELIVERY_MODE: "resend", RESEND_API_KEY: "re_test" },
      fetcher as unknown as typeof fetch,
    ).send(message);

    expect(result.mode).toBe("resend");
    expect(result.messageStatus).toBe("failed");
    expect(result.error).toMatch(/verified sender is missing/i);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("keeps non-allowlisted demo recipients simulated", async () => {
    const fetcher = vi.fn();
    const result = await createEmailDelivery(
      {
        EMAIL_DELIVERY_MODE: "resend",
        EMAIL_DELIVERY_ALLOWLIST: "authorized@example.com",
        RESEND_API_KEY: "re_test",
        RESEND_FROM_EMAIL: "SpeakerOps <updates@example.com>",
      },
      fetcher as unknown as typeof fetch,
    ).send({ ...message, toEmail: "fictional-speaker@example.test" });

    expect(result.messageStatus).toBe("sent_simulated");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("sends plain text through Resend with an idempotency key", async () => {
    const fetcher = vi.fn(async (_input: URL | RequestInfo, _init?: RequestInit) =>
      Response.json({ id: "email_provider_123" }));
    const result = await createEmailDelivery(
      {
        EMAIL_DELIVERY_MODE: "resend",
        RESEND_API_KEY: "re_test",
        RESEND_FROM_EMAIL: "SpeakerOps <updates@example.com>",
      },
      fetcher as unknown as typeof fetch,
    ).send(message);

    expect(result).toEqual({
      mode: "resend",
      status: "success",
      messageStatus: "sent",
      providerId: "email_provider_123",
      error: null,
    });
    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe("https://api.resend.com/emails");
    expect(init?.headers).toMatchObject({
      authorization: "Bearer re_test",
      "idempotency-key": "speakerops/msg_123",
    });
    expect(JSON.parse(String(init?.body))).toEqual({
      from: "SpeakerOps <updates@example.com>",
      to: ["authorized@example.com"],
      subject: "SpeakerOps delivery test",
      text: "This is a labeled transport test.",
    });
  });

  it("returns a persisted-safe failure when Resend rejects a message", async () => {
    const fetcher = vi.fn(async (_input: URL | RequestInfo, _init?: RequestInit) => Response.json(
      { name: "validation_error", message: "The example.com domain is not verified." },
      { status: 403 },
    ));
    const result = await createEmailDelivery(
      {
        EMAIL_DELIVERY_MODE: "resend",
        RESEND_API_KEY: "re_test",
        RESEND_FROM_EMAIL: "SpeakerOps <updates@example.com>",
      },
      fetcher as unknown as typeof fetch,
    ).send(message);

    expect(result.messageStatus).toBe("failed");
    expect(result.status).toBe("failure");
    expect(result.error).toContain("not verified");
  });
});
