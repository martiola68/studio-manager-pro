import crypto from "crypto";

export function generateSecurePassword(): string {
  const lunghezza = 10;
  
  const maiuscole = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const minuscole = "abcdefghijklmnopqrstuvwxyz";
  const numeri = "0123456789";
  const speciali = "!@#$%^&*()_+-=[]{}|;:,.<>?";
  
  let password = "";
  
  password += getRandomChar(maiuscole);
  password += getRandomChar(maiuscole);
  
  password += getRandomChar(numeri);
  password += getRandomChar(numeri);
  
  password += getRandomChar(speciali);
  
  const tuttiCaratteri = maiuscole + minuscole + numeri + speciali;
  for (let i = 0; i < 5; i++) {
    password += getRandomChar(tuttiCaratteri);
  }
  
  password = shuffleString(password);
  
  return password;
}

function getRandomChar(chars: string): string {
  const randomIndex = crypto.randomInt(0, chars.length);
  return chars[randomIndex];
}

function shuffleString(str: string): string {
  const arr = str.split("");
  for (let i = arr.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.join("");
}

export function validatePassword(password: string): boolean {
  const maiuscole = (password.match(/[A-Z]/g) || []).length;
  const numeri = (password.match(/[0-9]/g) || []).length;
  const speciali = (password.match(/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/g) || []).length;
  
  return (
    password.length === 10 &&
    maiuscole >= 2 &&
    numeri >= 2 &&
    speciali >= 1
  );
}