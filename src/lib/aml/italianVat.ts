/** Validazione formale P. IVA italiana: 11 cifre e checksum modulo 10. */
export function isValidItalianVat(value: string): boolean {
  if (!/^\\d{11}$/.test(value) || /^(\\d)\\1{10}$/.test(value)) return false;
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const digit = Number(value[i]);
    if (i % 2 === 0) sum += digit;
    else {
      const doubled = digit * 2;
      sum += doubled > 9 ? doubled - 9 : doubled;
    }
  }
  return (10 - (sum % 10)) % 10 === Number(value[10]);
}
