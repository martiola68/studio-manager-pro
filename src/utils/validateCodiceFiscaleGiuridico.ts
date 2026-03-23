export function validateCodiceFiscaleGiuridico(value: string): boolean {
  const cf = (value || "").replace(/\s+/g, "").toUpperCase();

  if (!/^\d{11}$/.test(cf)) return false;

  let sum = 0;

  for (let i = 0; i < 11; i++) {
    let n = parseInt(cf.charAt(i), 10);

    if (i % 2 === 0) {
      n = n * 1;
    } else {
      n = n * 2;
      if (n > 9) n -= 9;
    }

    sum += n;
  }

  return sum % 10 === 0;
}
