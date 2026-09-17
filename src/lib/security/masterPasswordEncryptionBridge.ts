"use client";

import { supabase } from "@/lib/supabase/client";
import {
  clearEncryptionKey,
  deriveKey,
  isEncrypted,
  storeEncryptionKey,
  verifyEncryptionKey,
} from "@/lib/encryption";
import {
  getStudioSalt,
  isEncryptionEnabled,
} from "@/services/encryptionService";

type VerificationSource = {
  table: string;
  fields: readonly string[];
};

type EncryptionBridgeResult = {
  enabled: boolean;
  unlocked: boolean;
  reason?:
    | "encryption-disabled"
    | "missing-salt"
    | "no-verification-sample"
    | "password-mismatch"
    | "verification-error";
};

const VERIFICATION_SOURCES: readonly VerificationSource[] = [
  {
    table: "tbcassetti_fiscali",
    fields: ["username", "password1", "password2", "pin", "pw_iniziale"],
  },
  {
    table: "tbclienti",
    fields: [
      "codice_fiscale",
      "partita_iva",
      "matricola_inps",
      "pat_inail",
      "codice_ditta_ce",
      "note",
    ],
  },
  {
    table: "tbcontatti",
    fields: [
      "cell",
      "tel",
      "altro_telefono",
      "email",
      "pec",
      "email_secondaria",
      "email_altro",
      "note",
    ],
  },
  {
    table: "tbcredenziali_accesso",
    fields: ["login_pw", "login_pin"],
  },
] as const;

async function findEncryptedVerificationSample(
  studioId: string
): Promise<string | null> {
  for (const source of VERIFICATION_SOURCES) {
    const { data, error } = await (supabase as any)
      .from(source.table)
      .select(source.fields.join(","))
      .eq("studio_id", studioId)
      .limit(200);

    if (error) {
      console.warn(
        `[MasterPasswordEncryptionBridge] Impossibile verificare ${source.table}:`,
        error
      );
      continue;
    }

    for (const row of data || []) {
      for (const field of source.fields) {
        const value = row?.[field];
        if (typeof value === "string" && isEncrypted(value)) {
          return value;
        }
      }
    }
  }

  return null;
}

/**
 * Dopo che la Master Password e' stata verificata contro master_password_hash,
 * prova ad aprire anche la chiave AES gia' configurata nello studio.
 *
 * Non inizializza la cifratura, non genera nuovi salt e non migra dati.
 * Se non esiste un campione cifrato verificabile, lascia intenzionalmente la
 * chiave cifratura bloccata per evitare di memorizzare una chiave non provata.
 */
export async function syncEncryptionKeyFromMasterPassword(
  studioId: string,
  masterPassword: string
): Promise<EncryptionBridgeResult> {
  try {
    const enabled = await isEncryptionEnabled(studioId);
    if (!enabled) {
      return {
        enabled: false,
        unlocked: false,
        reason: "encryption-disabled",
      };
    }

    const salt = await getStudioSalt(studioId);
    if (!salt) {
      return {
        enabled: true,
        unlocked: false,
        reason: "missing-salt",
      };
    }

    const encryptedSample = await findEncryptedVerificationSample(studioId);
    if (!encryptedSample) {
      return {
        enabled: true,
        unlocked: false,
        reason: "no-verification-sample",
      };
    }

    const key = deriveKey(masterPassword, salt);
    const valid = await verifyEncryptionKey(key, encryptedSample);

    if (!valid) {
      return {
        enabled: true,
        unlocked: false,
        reason: "password-mismatch",
      };
    }

    storeEncryptionKey(key);
    return { enabled: true, unlocked: true };
  } catch (error) {
    console.warn(
      "[MasterPasswordEncryptionBridge] Sincronizzazione chiave non riuscita:",
      error
    );
    return {
      enabled: true,
      unlocked: false,
      reason: "verification-error",
    };
  }
}

export function clearMasterPasswordEncryptionKey(): void {
  if (typeof window === "undefined") return;
  clearEncryptionKey();
}
