import { describe, expect, it } from "vitest";
import { createPasswordRecord, submitterTokenHash, verifyPassword } from "./submitterAuth";

describe("submitter account credentials", () => {
  it("verifies only the password used to create the record", async () => {
    const record = await createPasswordRecord("a-long-demo-password");
    expect(record.salt).toMatch(/^[0-9a-f]{32}$/);
    expect(record.hash).toMatch(/^[0-9a-f]{64}$/);
    await expect(verifyPassword("a-long-demo-password", record.salt, record.hash)).resolves.toBe(true);
    await expect(verifyPassword("not-the-password", record.salt, record.hash)).resolves.toBe(false);
  });

  it("hashes session tokens deterministically without retaining the token", async () => {
    await expect(submitterTokenHash("subsess_private-token")).resolves.toMatch(/^[0-9a-f]{64}$/);
    expect(await submitterTokenHash("subsess_private-token")).toBe(await submitterTokenHash("subsess_private-token"));
    expect(await submitterTokenHash("subsess_private-token")).not.toBe(await submitterTokenHash("subsess_other"));
  });
});
