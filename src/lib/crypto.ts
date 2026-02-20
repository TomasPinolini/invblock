import { randomBytes, createCipheriv, createDecipheriv } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error("ENCRYPTION_KEY environment variable is not set");
  }
  // Key must be 32 bytes (64 hex chars) for AES-256
  const keyBuffer = Buffer.from(key, "hex");
  if (keyBuffer.length !== 32) {
    throw new Error("ENCRYPTION_KEY must be 64 hex characters (32 bytes)");
  }
  return keyBuffer;
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns base64-encoded string: iv + authTag + ciphertext
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Pack: iv (12) + tag (16) + ciphertext
  const packed = Buffer.concat([iv, authTag, encrypted]);
  return packed.toString("base64");
}

/**
 * Decrypt a base64-encoded AES-256-GCM encrypted string.
 * Also handles legacy plaintext JSON (unencrypted) for migration.
 * Falls back to returning raw string if decryption fails (key mismatch).
 */
export function decrypt(encryptedBase64: string): string {
  // Handle legacy unencrypted JSON — starts with { or [
  if (encryptedBase64.startsWith("{") || encryptedBase64.startsWith("[")) {
    return encryptedBase64;
  }

  const key = getEncryptionKey();
  const packed = Buffer.from(encryptedBase64, "base64");

  if (packed.length < IV_LENGTH + TAG_LENGTH + 1) {
    // Too short to be encrypted, treat as legacy plaintext
    return encryptedBase64;
  }

  try {
    const iv = packed.subarray(0, IV_LENGTH);
    const authTag = packed.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const ciphertext = packed.subarray(IV_LENGTH + TAG_LENGTH);

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    return decrypted.toString("utf8");
  } catch {
    // Decryption failed (key mismatch, corrupted data, etc.)
    // Try treating as legacy plaintext — if it's valid JSON, return it
    try {
      JSON.parse(encryptedBase64);
      return encryptedBase64;
    } catch {
      // Not valid JSON either — the credentials are unrecoverable
      console.error("[Crypto] Decryption failed and data is not valid JSON. User needs to reconnect.");
      throw new Error("Stored credentials could not be decrypted. Please reconnect your account.");
    }
  }
}

/**
 * Encrypt credentials object (JSON.stringify + encrypt).
 */
export function encryptCredentials(credentials: unknown): string {
  return encrypt(JSON.stringify(credentials));
}

/**
 * Decrypt credentials string and parse as JSON.
 * Handles both encrypted and legacy plaintext JSON.
 */
export function decryptCredentials<T = unknown>(stored: string): T {
  const decrypted = decrypt(stored);
  return JSON.parse(decrypted) as T;
}
