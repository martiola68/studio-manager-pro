/**
 * Encryption Library for Cassetti Fiscali Password Protection
 * Uses AES-256-GCM with PBKDF2 key derivation
 */

import crypto from 'crypto';

// Encryption configuration
const ENCRYPTION_CONFIG = {
  algorithm: 'aes-256-gcm' as const,
  keyLength: 32, // 256 bits
  ivLength: 16, // 128 bits
  saltLength: 32, // 256 bits
  iterations: 100000, // PBKDF2 iterations
  digest: 'sha256' as const,
  encoding: 'hex' as const,
};

/**
 * Generate a random salt for PBKDF2
 */
export function generateSalt(): string {
  return crypto.randomBytes(ENCRYPTION_CONFIG.saltLength).toString(ENCRYPTION_CONFIG.encoding);
}

/**
 * Derive encryption key from master password and salt
 */
export function deriveKey(masterPassword: string, salt: string): Buffer {
  const saltBuffer = Buffer.from(salt, ENCRYPTION_CONFIG.encoding);
  
  return crypto.pbkdf2Sync(
    masterPassword,
    saltBuffer,
    ENCRYPTION_CONFIG.iterations,
    ENCRYPTION_CONFIG.keyLength,
    ENCRYPTION_CONFIG.digest
  );
}

/**
 * Encrypt a plaintext string
 * Returns format: iv:authTag:encryptedData
 */
export function encryptData(plaintext: string, key: Buffer): string {
  const iv = crypto.randomBytes(ENCRYPTION_CONFIG.ivLength);
  const cipher = crypto.createCipheriv(ENCRYPTION_CONFIG.algorithm, key, iv);
  
  let encrypted = cipher.update(plaintext, 'utf8', ENCRYPTION_CONFIG.encoding);
  encrypted += cipher.final(ENCRYPTION_CONFIG.encoding);
  
  const authTag = cipher.getAuthTag();
  
  // Return format: iv:authTag:encrypted
  return [
    iv.toString(ENCRYPTION_CONFIG.encoding),
    authTag.toString(ENCRYPTION_CONFIG.encoding),
    encrypted
  ].join(':');
}

/**
 * Decrypt an encrypted string
 * Expects format: iv:authTag:encryptedData
 */
export function decryptData(encryptedData: string, key: Buffer): string {
  const parts = encryptedData.split(':');
  
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format');
  }
  
  const [ivHex, authTagHex, encrypted] = parts;
  
  const iv = Buffer.from(ivHex, ENCRYPTION_CONFIG.encoding);
  const authTag = Buffer.from(authTagHex, ENCRYPTION_CONFIG.encoding);
  
  const decipher = crypto.createDecipheriv(ENCRYPTION_CONFIG.algorithm, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, ENCRYPTION_CONFIG.encoding, 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Check if a string is encrypted (basic format check)
 */
export function isEncrypted(data: string | null | undefined): boolean {
  if (!data) return false;
  
  // Check for encryption format: iv:authTag:data (3 parts separated by :)
  const parts = data.split(':');
  return parts.length === 3 && 
         parts[0].length === ENCRYPTION_CONFIG.ivLength * 2 &&
         parts[1].length === 16 * 2; // Auth tag is 16 bytes
}

/**
 * Session storage keys
 */
export const SESSION_KEYS = {
  ENCRYPTION_KEY: 'cassetti_encryption_key',
  LAST_ACTIVITY: 'cassetti_last_activity',
  IS_UNLOCKED: 'cassetti_is_unlocked',
} as const;

/**
 * Auto-lock timeout (15 minutes in milliseconds)
 */
export const AUTO_LOCK_TIMEOUT = 15 * 60 * 1000;

/**
 * Store encryption key in session
 */
export function storeEncryptionKey(key: Buffer): void {
  sessionStorage.setItem(SESSION_KEYS.ENCRYPTION_KEY, key.toString(ENCRYPTION_CONFIG.encoding));
  sessionStorage.setItem(SESSION_KEYS.LAST_ACTIVITY, Date.now().toString());
  sessionStorage.setItem(SESSION_KEYS.IS_UNLOCKED, 'true');
}

/**
 * Get encryption key from session
 */
export function getStoredEncryptionKey(): Buffer | null {
  const keyHex = sessionStorage.getItem(SESSION_KEYS.ENCRYPTION_KEY);
  if (!keyHex) return null;
  
  return Buffer.from(keyHex, ENCRYPTION_CONFIG.encoding);
}

/**
 * Clear encryption key from session (lock)
 */
export function clearEncryptionKey(): void {
  sessionStorage.removeItem(SESSION_KEYS.ENCRYPTION_KEY);
  sessionStorage.removeItem(SESSION_KEYS.LAST_ACTIVITY);
  sessionStorage.removeItem(SESSION_KEYS.IS_UNLOCKED);
}

/**
 * Check if session is unlocked
 */
export function isUnlocked(): boolean {
  return sessionStorage.getItem(SESSION_KEYS.IS_UNLOCKED) === 'true';
}

/**
 * Update last activity timestamp
 */
export function updateLastActivity(): void {
  if (isUnlocked()) {
    sessionStorage.setItem(SESSION_KEYS.LAST_ACTIVITY, Date.now().toString());
  }
}

/**
 * Check if session should be locked (timeout exceeded)
 */
export function shouldAutoLock(): boolean {
  const lastActivity = sessionStorage.getItem(SESSION_KEYS.LAST_ACTIVITY);
  if (!lastActivity) return true;
  
  const timeSinceLastActivity = Date.now() - parseInt(lastActivity, 10);
  return timeSinceLastActivity > AUTO_LOCK_TIMEOUT;
}

/**
 * Verify encryption key by attempting to decrypt a test cassetto
 */
export async function verifyEncryptionKey(key: Buffer, testEncryptedData: string): Promise<boolean> {
  try {
    decryptData(testEncryptedData, key);
    return true;
  } catch {
    return false;
  }
}