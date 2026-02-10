import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { encrypt, decrypt, encryptCredentials, decryptCredentials } from "./crypto";

// Use a fixed test key (32 bytes = 64 hex chars)
const TEST_KEY = "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2";

beforeEach(() => {
  vi.stubEnv("ENCRYPTION_KEY", TEST_KEY);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("encrypt / decrypt", () => {
  it("round-trips a simple string", () => {
    const plaintext = "hello world";
    const encrypted = encrypt(plaintext);
    expect(encrypted).not.toBe(plaintext);
    expect(decrypt(encrypted)).toBe(plaintext);
  });

  it("round-trips JSON", () => {
    const data = JSON.stringify({ access_token: "abc123", refresh_token: "xyz" });
    const encrypted = encrypt(data);
    expect(decrypt(encrypted)).toBe(data);
  });

  it("produces different ciphertext for same plaintext (random IV)", () => {
    const plaintext = "same input";
    const a = encrypt(plaintext);
    const b = encrypt(plaintext);
    expect(a).not.toBe(b); // Different IVs
    expect(decrypt(a)).toBe(plaintext);
    expect(decrypt(b)).toBe(plaintext);
  });

  it("handles unicode content", () => {
    const plaintext = "Símbolo: GGAL — Operación éxitosa 🎉";
    expect(decrypt(encrypt(plaintext))).toBe(plaintext);
  });

  it("handles long content", () => {
    const longText = "x".repeat(10000);
    expect(decrypt(encrypt(longText))).toBe(longText);
  });
});

describe("decrypt — legacy plaintext fallback", () => {
  it("passes through JSON objects (starts with {)", () => {
    const legacy = '{"access_token":"abc","refresh_token":"xyz"}';
    expect(decrypt(legacy)).toBe(legacy);
  });

  it("passes through JSON arrays (starts with [)", () => {
    const legacy = '[{"key":"value"}]';
    expect(decrypt(legacy)).toBe(legacy);
  });

  it("passes through short strings as legacy", () => {
    const short = "too-short";
    expect(decrypt(short)).toBe(short);
  });
});

describe("encryptCredentials / decryptCredentials", () => {
  it("round-trips an IOL token object", () => {
    const token = {
      access_token: "eyJhbGciOi...",
      refresh_token: "dGhpcyBpcyBhIHRlc3Q=",
      expires_in: 900,
      token_type: "bearer",
    };
    const encrypted = encryptCredentials(token);
    const decrypted = decryptCredentials<typeof token>(encrypted);
    expect(decrypted).toEqual(token);
  });

  it("round-trips Binance credentials", () => {
    const creds = { apiKey: "abc123", apiSecret: "secret456" };
    const encrypted = encryptCredentials(creds);
    const decrypted = decryptCredentials<typeof creds>(encrypted);
    expect(decrypted).toEqual(creds);
  });

  it("decryptCredentials handles legacy plaintext JSON", () => {
    const legacy = '{"apiKey":"abc","apiSecret":"xyz"}';
    const result = decryptCredentials<{ apiKey: string; apiSecret: string }>(legacy);
    expect(result.apiKey).toBe("abc");
    expect(result.apiSecret).toBe("xyz");
  });
});

describe("error handling", () => {
  it("throws when ENCRYPTION_KEY is missing", () => {
    vi.stubEnv("ENCRYPTION_KEY", "");
    expect(() => encrypt("test")).toThrow("ENCRYPTION_KEY");
  });

  it("throws when ENCRYPTION_KEY is wrong length", () => {
    vi.stubEnv("ENCRYPTION_KEY", "tooshort");
    expect(() => encrypt("test")).toThrow("64 hex characters");
  });

  it("throws on tampered ciphertext", () => {
    const encrypted = encrypt("secret data");
    // Tamper with the base64 content
    const tampered = encrypted.slice(0, -4) + "XXXX";
    expect(() => decrypt(tampered)).toThrow();
  });
});
