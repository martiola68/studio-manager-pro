import crypto from "crypto";

/**
 * AES-256-GCM Encryption Service for Microsoft 365 Secrets
 * 
 * Uses authenticated encryption with random IV per operation.
 * Encryption key MUST be stored in environment variable ENCRYPTION_KEY_M365.
 * 
 * Format: iv:authTag:encrypted
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits
const KEY_LENGTH = 32; // 256 bits

/**
 * Get encryption key from environment
 * CRITICAL: This key must be kept secret and never committed to version control
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY_M365;
  
  if (!key) {
    throw new Error(
      "ENCRYPTION_KEY_M365 not found in environment variables. " +
      "Generate one with: openssl rand -hex 32"
    );
  }

  // Convert hex string to buffer
  const keyBuffer = Buffer.from(key, "hex");
  
  if (keyBuffer.length !== KEY_LENGTH) {
    throw new Error(
      `ENCRYPTION_KEY_M365 must be ${KEY_LENGTH * 2} hex characters (${KEY_LENGTH} bytes). ` +
      `Current length: ${keyBuffer.length} bytes`
    );
  }

  return keyBuffer;
}

/**
 * Encrypt text using AES-256-GCM
 * 
 * @param text - Plain text to encrypt
 * @returns Encrypted string in format: iv:authTag:encrypted (all hex)
 */
export function encrypt(text: string): string {
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");
    
    const authTag = cipher.getAuthTag();
    
    // Format: iv:authTag:encrypted (all hex)
    return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
  } catch (error) {
    console.error("Encryption error:", error);
    throw new Error("Failed to encrypt data");
  }
}

/**
 * Decrypt AES-256-GCM encrypted text
 * 
 * @param encryptedData - Encrypted string in format: iv:authTag:encrypted
 * @returns Decrypted plain text
 */
export function decrypt(encryptedData: string): string {
  try {
    const key = getEncryptionKey();
    
    // Parse format: iv:authTag:encrypted
    const parts = encryptedData.split(":");
    if (parts.length !== 3) {
      throw new Error("Invalid encrypted data format");
    }
    
    const iv = Buffer.from(parts[0], "hex");
    const authTag = Buffer.from(parts[1], "hex");
    const encrypted = parts[2];
    
    if (iv.length !== IV_LENGTH) {
      throw new Error(`Invalid IV length: ${iv.length}`);
    }
    
    if (authTag.length !== AUTH_TAG_LENGTH) {
      throw new Error(`Invalid auth tag length: ${authTag.length}`);
    }
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    
    return decrypted;
  } catch (error) {
    console.error("Decryption error:", error);
    throw new Error("Failed to decrypt data. Key may be incorrect or data corrupted.");
  }
}

/**
 * Generate a new encryption key (for initial setup)
 * Run this once and store the result in ENCRYPTION_KEY_M365 environment variable
 * 
 * @returns Hex string (64 characters)
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(KEY_LENGTH).toString("hex");
}

/**
 * Validate encryption key format
 */
export function validateEncryptionKey(key: string): boolean {
  try {
    const buffer = Buffer.from(key, "hex");
    return buffer.length === KEY_LENGTH;
  } catch {
    return false;
  }
}