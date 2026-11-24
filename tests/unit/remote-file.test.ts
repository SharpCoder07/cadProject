import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/env", () => ({ env: { MAX_UPLOAD_MB: 10 } }));

const { isBlockedAddress, fetchRemoteFile } = await import("@/server/remote-file");

describe("pasted-link downloads", () => {
  it("blocks private, loopback, link-local and mapped addresses", () => {
    for (const a of ["127.0.0.1", "10.1.2.3", "169.254.169.254", "172.20.0.5", "192.168.1.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "::ffff:7f00:1", "0:0:0:0:0:ffff:a9fe:a9fe"]) {
      expect(isBlockedAddress(a), a).toBe(true);
    }
  });

  it("allows public addresses", () => {
    for (const a of ["8.8.8.8", "142.250.183.110", "::ffff:8.8.8.8", "2606:4700:4700::1111"]) expect(isBlockedAddress(a), a).toBe(false);
  });

  it("rejects unsafe links before connecting", async () => {
    await expect(fetchRemoteFile("ftp://example.com/a.png")).rejects.toThrow(/http and https/);
    await expect(fetchRemoteFile("https://user:pw@example.com/a.png")).rejects.toThrow(/username or password/);
    await expect(fetchRemoteFile("https://example.com:8080/a.png")).rejects.toThrow(/unusual port/);
    await expect(fetchRemoteFile("http://127.0.0.1/a.png")).rejects.toThrow(/private or internal/);
    await expect(fetchRemoteFile("http://[::1]/a.png")).rejects.toThrow(/private or internal/);
    await expect(fetchRemoteFile("http://localhost/a.png")).rejects.toThrow(/private or internal/);
    await expect(fetchRemoteFile("not a link")).rejects.toThrow(/full link/);
  });
});
