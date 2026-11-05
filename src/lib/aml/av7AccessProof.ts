import jwt from "jsonwebtoken";

type Proof = { uid: string; studio: string; societa: string; scope: "aml-av7" };

function secret(): string {
  const value = process.env.NEXTAUTH_SECRET;
  if (!value || value.length < 16) throw new Error("Chiave di verifica AML non configurata.");
  return value;
}

export function createAV7AccessProof(data: { uid: string; studio: string; societa: string }): string {
  return jwt.sign({ ...data, scope: "aml-av7" } satisfies Proof, secret(), {
    algorithm: "HS256", expiresIn: "20m",
  });
}

export function verifyAV7AccessProof(
  token: string,
  expected: { uid: string; studio: string; societa: string },
): boolean {
  if (!token) return false;
  try {
    const payload = jwt.verify(token, secret(), { algorithms: ["HS256"] }) as jwt.JwtPayload & Partial<Proof>;
    return payload.scope === "aml-av7" &&
      payload.uid === expected.uid &&
      payload.studio === expected.studio &&
      payload.societa === expected.societa;
  } catch {
    return false;
  }
}
