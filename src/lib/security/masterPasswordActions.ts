import {
  decryptData,
  getStoredEncryptionKey,
  isEncrypted,
} from "@/lib/encryption";

export function hasEncryptionKey(): boolean {
  return Boolean(getStoredEncryptionKey());
}

export function decryptIfNeeded(value?: string | null): string | null | undefined {
  if (!value) return value;

  const key = getStoredEncryptionKey();
  if (!key) return value;

  return isEncrypted(value) ? decryptData(value, key) : value;
}

export function copyProtectedValue(params: {
  value?: string | null;
  label: string;
  encryptionEnabled: boolean;
  requireUnlock: (action: () => void | Promise<void>) => void;
  doCopy: (text: string, label: string) => void;
}) {
  const { value, label, encryptionEnabled, requireUnlock, doCopy } = params;

  if (!value) return;

  if (encryptionEnabled && !hasEncryptionKey() && isEncrypted(value)) {
    requireUnlock(async () => {
      const plainValue = decryptIfNeeded(value);
      if (plainValue) {
        doCopy(plainValue, label);
      }
    });
    return;
  }

  doCopy(value, label);
}

export function revealProtectedValue(params: {
  value?: string | null;
  encryptionEnabled: boolean;
  requireUnlock: (action: () => void | Promise<void>) => void;
  onReveal: () => void;
}) {
  const { value, encryptionEnabled, requireUnlock, onReveal } = params;

  if (value && encryptionEnabled && !hasEncryptionKey() && isEncrypted(value)) {
    requireUnlock(async () => {
      onReveal();
    });
    return;
  }

  onReveal();
}

export async function runProtectedSubmit(params: {
  encryptionEnabled: boolean;
  requireUnlock: (action: () => void | Promise<void>) => void;
  action: () => Promise<void>;
}) {
  const { encryptionEnabled, requireUnlock, action } = params;

  if (encryptionEnabled && !hasEncryptionKey()) {
    requireUnlock(async () => {
      await action();
    });
    return;
  }

  await action();
}
