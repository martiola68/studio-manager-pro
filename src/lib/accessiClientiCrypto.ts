import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";

function getKey() {
  const secret = process.env.ACCESSI_CLIENTI_SECRET;

  if (!secret) {
    throw new Error("ACCESSI_CLIENTI_SECRET mancante");
  }

  return crypto.createHash("sha256").update(secret).digest();
}

export function criptaPassword(password: string) {
  const iv = crypto.randomBytes(12);
  const key = getKey();

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(password, "utf8"),
    cipher.final(),
  ]);

  const tag = cipher.getAuthTag();

  return [
    iv.toString("base64"),
    tag.toString("base64"),
    encrypted.toString("base64"),
  ].join(".");
}

export function decriptaPassword(payload: string) {
  const [ivBase64, tagBase64, encryptedBase64] = payload.split(".");

  if (!ivBase64 || !tagBase64 || !encryptedBase64) {
    throw new Error("Password cifrata non valida");
  }

  const key = getKey();
  const iv = Buffer.from(ivBase64, "base64");
  const tag = Buffer.from(tagBase64, "base64");
  const encrypted = Buffer.from(encryptedBase64, "base64");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}
