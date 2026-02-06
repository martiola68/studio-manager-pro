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

/**
 * Encrypt cliente sensitive data (CF, P.IVA, matricole, note)
 */
export async function encryptClienteSensitiveData(cliente: {
  codice_fiscale?: string | null;
  partita_iva?: string | null;
  matricola_inps?: string | null;
  pat_inail?: string | null;
  codice_ditta_ce?: string | null;
  note?: string | null;
  note_antiriciclaggio?: string | null;
}): Promise<{
  codice_fiscale?: string | null;
  partita_iva?: string | null;
  matricola_inps?: string | null;
  pat_inail?: string | null;
  codice_ditta_ce?: string | null;
  note?: string | null;
  note_antiriciclaggio?: string | null;
}> {
  const key = getStoredEncryptionKey();
  if (!key) {
    throw new Error("Cassetti locked - unlock first");
  }

  return {
    codice_fiscale: cliente.codice_fiscale
      ? encryptData(cliente.codice_fiscale, key)
      : null,
    partita_iva: cliente.partita_iva
      ? encryptData(cliente.partita_iva, key)
      : null,
    matricola_inps: cliente.matricola_inps
      ? encryptData(cliente.matricola_inps, key)
      : null,
    pat_inail: cliente.pat_inail ? encryptData(cliente.pat_inail, key) : null,
    codice_ditta_ce: cliente.codice_ditta_ce
      ? encryptData(cliente.codice_ditta_ce, key)
      : null,
    note: cliente.note ? encryptData(cliente.note, key) : null,
    note_antiriciclaggio: cliente.note_antiriciclaggio
      ? encryptData(cliente.note_antiriciclaggio, key)
      : null,
  };
}

/**
 * Decrypt cliente sensitive data
 */
export async function decryptClienteSensitiveData(cliente: {
  codice_fiscale?: string | null;
  partita_iva?: string | null;
  matricola_inps?: string | null;
  pat_inail?: string | null;
  codice_ditta_ce?: string | null;
  note?: string | null;
  note_antiriciclaggio?: string | null;
}): Promise<{
  codice_fiscale?: string | null;
  partita_iva?: string | null;
  matricola_inps?: string | null;
  pat_inail?: string | null;
  codice_ditta_ce?: string | null;
  note?: string | null;
  note_antiriciclaggio?: string | null;
}> {
  const key = getStoredEncryptionKey();
  if (!key) {
    throw new Error("Cassetti locked - unlock first");
  }

  return {
    codice_fiscale:
      cliente.codice_fiscale && isEncrypted(cliente.codice_fiscale)
        ? decryptData(cliente.codice_fiscale, key)
        : cliente.codice_fiscale,
    partita_iva:
      cliente.partita_iva && isEncrypted(cliente.partita_iva)
        ? decryptData(cliente.partita_iva, key)
        : cliente.partita_iva,
    matricola_inps:
      cliente.matricola_inps && isEncrypted(cliente.matricola_inps)
        ? decryptData(cliente.matricola_inps, key)
        : cliente.matricola_inps,
    pat_inail:
      cliente.pat_inail && isEncrypted(cliente.pat_inail)
        ? decryptData(cliente.pat_inail, key)
        : cliente.pat_inail,
    codice_ditta_ce:
      cliente.codice_ditta_ce && isEncrypted(cliente.codice_ditta_ce)
        ? decryptData(cliente.codice_ditta_ce, key)
        : cliente.codice_ditta_ce,
    note:
      cliente.note && isEncrypted(cliente.note)
        ? decryptData(cliente.note, key)
        : cliente.note,
    note_antiriciclaggio:
      cliente.note_antiriciclaggio && isEncrypted(cliente.note_antiriciclaggio)
        ? decryptData(cliente.note_antiriciclaggio, key)
        : cliente.note_antiriciclaggio,
  };
}

/**
 * Migrate all clienti for studio
 */
export async function migrateAllClientiToEncrypted(
  studioId: string
): Promise<{ success: boolean; migrated: number; errors: number }> {
  try {
    const key = getStoredEncryptionKey();
    if (!key) {
      throw new Error("Cassetti locked - unlock first");
    }

    // Get all clienti
    const { data: clienti, error: fetchError } = await supabase
      .from("tbclienti")
      .select("*")
      .eq("studio_id", studioId);

    if (fetchError) throw fetchError;
    if (!clienti) return { success: true, migrated: 0, errors: 0 };

    let migrated = 0;
    let errors = 0;

    for (const cliente of clienti) {
      // Skip if already encrypted
      if (cliente.codice_fiscale && isEncrypted(cliente.codice_fiscale)) {
        continue;
      }

      try {
        const encrypted = await encryptClienteSensitiveData(cliente);

        const { error: updateError } = await supabase
          .from("tbclienti")
          .update({
            ...encrypted,
            updated_at: new Date().toISOString(),
          })
          .eq("id", cliente.id)
          .eq("studio_id", studioId);

        if (updateError) throw updateError;
        migrated++;
      } catch (error) {
        errors++;
        console.error(`Failed to migrate cliente ${cliente.id}:`, error);
      }
    }

    return { success: true, migrated, errors };
  } catch (error) {
    console.error("Migrate all clienti error:", error);
    return { success: false, migrated: 0, errors: 0 };
  }
}

/**
 * Encrypt credenziali accesso passwords
 */
export async function encryptCredenzialiAccesso(credenziali: {
  login_pw?: string | null;
  login_pin?: string | null;
}): Promise<{
  login_pw?: string | null;
  login_pin?: string | null;
}> {
  const key = getStoredEncryptionKey();
  if (!key) {
    throw new Error("Cassetti locked - unlock first");
  }

  return {
    login_pw: credenziali.login_pw
      ? encryptData(credenziali.login_pw, key)
      : null,
    login_pin: credenziali.login_pin
      ? encryptData(credenziali.login_pin, key)
      : null,
  };
}

/**
 * Decrypt credenziali accesso passwords
 */
export async function decryptCredenzialiAccesso(credenziali: {
  login_pw?: string | null;
  login_pin?: string | null;
}): Promise<{
  login_pw?: string | null;
  login_pin?: string | null;
}> {
  const key = getStoredEncryptionKey();
  if (!key) {
    throw new Error("Cassetti locked - unlock first");
  }

  return {
    login_pw:
      credenziali.login_pw && isEncrypted(credenziali.login_pw)
        ? decryptData(credenziali.login_pw, key)
        : credenziali.login_pw,
    login_pin:
      credenziali.login_pin && isEncrypted(credenziali.login_pin)
        ? decryptData(credenziali.login_pin, key)
        : credenziali.login_pin,
  };
}

/**
 * Migrate all credenziali accesso for studio
 */
export async function migrateAllCredenzialiToEncrypted(
  studioId: string
): Promise<{ success: boolean; migrated: number; errors: number }> {
  try {
    const key = getStoredEncryptionKey();
    if (!key) {
      throw new Error("Cassetti locked - unlock first");
    }

    // Get all credenziali
    const { data: credenziali, error: fetchError } = await supabase
      .from("tbcredenziali_accesso")
      .select("*")
      .eq("studio_id", studioId);

    if (fetchError) throw fetchError;
    if (!credenziali) return { success: true, migrated: 0, errors: 0 };

    let migrated = 0;
    let errors = 0;

    for (const cred of credenziali) {
      // Skip if already encrypted
      if (cred.login_pw && isEncrypted(cred.login_pw)) {
        continue;
      }

      try {
        const encrypted = await encryptCredenzialiAccesso(cred);

        const { error: updateError } = await supabase
          .from("tbcredenziali_accesso")
          .update({
            ...encrypted,
            updated_at: new Date().toISOString(),
          })
          .eq("id", cred.id)
          .eq("studio_id", studioId);

        if (updateError) throw updateError;
        migrated++;
      } catch (error) {
        errors++;
        console.error(`Failed to migrate credenziale ${cred.id}:`, error);
      }
    }

    return { success: true, migrated, errors };
  } catch (error) {
    console.error("Migrate all credenziali error:", error);
    return { success: false, migrated: 0, errors: 0 };
  }
}