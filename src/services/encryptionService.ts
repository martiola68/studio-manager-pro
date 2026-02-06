/**
 * Encryption Service for Cassetti Fiscali
 * Handles password encryption/decryption and key management
 */

import { supabase } from "@/lib/supabase/client";
import {
  deriveKey,
  encryptData,
  decryptData,
  generateSalt,
  storeEncryptionKey,
  getStoredEncryptionKey,
  clearEncryptionKey,
  isUnlocked,
  isEncrypted,
  verifyEncryptionKey,
} from "@/lib/encryption";

/**
 * Check if studio has encryption enabled
 */
export async function isEncryptionEnabled(studioId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("tbstudio")
    .select("encryption_enabled")
    .eq("id", studioId)
    .single();

  if (error) throw error;
  return data?.encryption_enabled || false;
}

/**
 * Get studio encryption salt
 */
export async function getStudioSalt(studioId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("tbstudio")
    .select("encryption_salt")
    .eq("id", studioId)
    .single();

  if (error) throw error;
  return data?.encryption_salt || null;
}

/**
 * Setup encryption for studio (first time)
 */
export async function setupStudioEncryption(
  studioId: string,
  masterPassword: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Generate salt
    const salt = generateSalt();

    // Derive key to verify password works
    const key = deriveKey(masterPassword, salt);

    // Update studio with salt and enable encryption
    const { error } = await supabase
      .from("tbstudio")
      .update({
        encryption_salt: salt,
        encryption_enabled: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", studioId);

    if (error) throw error;

    // Store key in session
    storeEncryptionKey(key);

    return { success: true };
  } catch (error) {
    console.error("Setup encryption error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Errore sconosciuto",
    };
  }
}

/**
 * Unlock cassetti fiscali with master password
 */
export async function unlockCassetti(
  studioId: string,
  masterPassword: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get salt from studio
    const salt = await getStudioSalt(studioId);
    if (!salt) {
      throw new Error("Studio encryption not configured");
    }

    // Derive key from password
    const key = deriveKey(masterPassword, salt);

    // Verify key by trying to decrypt first cassetto
    const { data: cassetti } = await supabase
      .from("tbcassetti_fiscali")
      .select("password1")
      .eq("studio_id", studioId)
      .not("password1", "is", null)
      .limit(1);

    if (cassetti && cassetti.length > 0) {
      const pwd = cassetti[0].password1;
      if (pwd && isEncrypted(pwd)) {
        const isValid = await verifyEncryptionKey(key, pwd);
        if (!isValid) {
          throw new Error("Password errata");
        }
      }
    }

    // Store key in session
    storeEncryptionKey(key);

    return { success: true };
  } catch (error) {
    console.error("Unlock cassetti error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Password errata",
    };
  }
}

/**
 * Lock cassetti fiscali (clear session key)
 */
export function lockCassetti(): void {
  clearEncryptionKey();
}

/**
 * Check if cassetti are unlocked
 */
export function areCassettiUnlocked(): boolean {
  return isUnlocked() && getStoredEncryptionKey() !== null;
}

/**
 * Encrypt cassetto passwords
 */
export async function encryptCassettoPasswords(cassetto: {
  password1?: string | null;
  password2?: string | null;
  pin?: string | null;
  pw_iniziale?: string | null;
}): Promise<{
  password1?: string | null;
  password2?: string | null;
  pin?: string | null;
  pw_iniziale?: string | null;
}> {
  const key = getStoredEncryptionKey();
  if (!key) {
    throw new Error("Cassetti locked - unlock first");
  }

  return {
    password1: cassetto.password1 ? encryptData(cassetto.password1, key) : null,
    password2: cassetto.password2 ? encryptData(cassetto.password2, key) : null,
    pin: cassetto.pin ? encryptData(cassetto.pin, key) : null,
    pw_iniziale: cassetto.pw_iniziale ? encryptData(cassetto.pw_iniziale, key) : null,
  };
}

/**
 * Decrypt cassetto passwords
 */
export async function decryptCassettoPasswords(cassetto: {
  password1?: string | null;
  password2?: string | null;
  pin?: string | null;
  pw_iniziale?: string | null;
}): Promise<{
  password1?: string | null;
  password2?: string | null;
  pin?: string | null;
  pw_iniziale?: string | null;
}> {
  const key = getStoredEncryptionKey();
  if (!key) {
    throw new Error("Cassetti locked - unlock first");
  }

  return {
    password1: cassetto.password1 && isEncrypted(cassetto.password1)
      ? decryptData(cassetto.password1, key)
      : cassetto.password1,
    password2: cassetto.password2 && isEncrypted(cassetto.password2)
      ? decryptData(cassetto.password2, key)
      : cassetto.password2,
    pin: cassetto.pin && isEncrypted(cassetto.pin)
      ? decryptData(cassetto.pin, key)
      : cassetto.pin,
    pw_iniziale: cassetto.pw_iniziale && isEncrypted(cassetto.pw_iniziale)
      ? decryptData(cassetto.pw_iniziale, key)
      : cassetto.pw_iniziale,
  };
}

/**
 * Migrate existing plaintext passwords to encrypted
 */
export async function migrateCassettoToEncrypted(
  cassettoId: string,
  studioId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const key = getStoredEncryptionKey();
    if (!key) {
      throw new Error("Cassetti locked - unlock first");
    }

    // Get cassetto
    const { data: cassetto, error: fetchError } = await supabase
      .from("tbcassetti_fiscali")
      .select("*")
      .eq("id", cassettoId)
      .eq("studio_id", studioId)
      .single();

    if (fetchError) throw fetchError;
    if (!cassetto) throw new Error("Cassetto not found");

    // Check if already encrypted
    if (isEncrypted(cassetto.password1)) {
      return { success: true }; // Already encrypted
    }

    // Encrypt passwords
    const encryptedPasswords = await encryptCassettoPasswords({
      password1: cassetto.password1,
      password2: cassetto.password2,
      pin: cassetto.pin,
      pw_iniziale: cassetto.pw_iniziale,
    });

    // Update cassetto
    const { error: updateError } = await supabase
      .from("tbcassetti_fiscali")
      .update({
        ...encryptedPasswords,
        updated_at: new Date().toISOString(),
      })
      .eq("id", cassettoId)
      .eq("studio_id", studioId);

    if (updateError) throw updateError;

    return { success: true };
  } catch (error) {
    console.error("Migration error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Errore migrazione",
    };
  }
}

/**
 * Migrate all cassetti for studio
 */
export async function migrateAllCassettiToEncrypted(
  studioId: string
): Promise<{ success: boolean; migrated: number; errors: number }> {
  try {
    const key = getStoredEncryptionKey();
    if (!key) {
      throw new Error("Cassetti locked - unlock first");
    }

    // Get all cassetti
    const { data: cassetti, error: fetchError } = await supabase
      .from("tbcassetti_fiscali")
      .select("*")
      .eq("studio_id", studioId);

    if (fetchError) throw fetchError;
    if (!cassetti) return { success: true, migrated: 0, errors: 0 };

    let migrated = 0;
    let errors = 0;

    for (const cassetto of cassetti) {
      // Skip if already encrypted
      if (isEncrypted(cassetto.password1)) {
        continue;
      }

      const result = await migrateCassettoToEncrypted(cassetto.id, studioId);
      if (result.success) {
        migrated++;
      } else {
        errors++;
        console.error(`Failed to migrate cassetto ${cassetto.id}:`, result.error);
      }
    }

    return { success: true, migrated, errors };
  } catch (error) {
    console.error("Migrate all error:", error);
    return { success: false, migrated: 0, errors: 0 };
  }
}