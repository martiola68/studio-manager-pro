export function calcolaGiorniResidui(dataScadenza?: string | null): number | null {
  if (!dataScadenza) return null;

  const oggi = new Date();
  const oggiLocale = new Date(
    oggi.getFullYear(),
    oggi.getMonth(),
    oggi.getDate()
  );

  const [yyyy, mm, dd] = dataScadenza.split("-").map(Number);

  if (!yyyy || !mm || !dd) return null;

  const scadenzaLocale = new Date(yyyy, mm - 1, dd);

  const diffMs = scadenzaLocale.getTime() - oggiLocale.getTime();

  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

export function getClasseGiorniResidui(giorni: number | null | undefined): string {
  if (giorni === null || giorni === undefined) {
    return "bg-gray-200 text-gray-700";
  }

  if (giorni < 0) {
    return "bg-red-700 text-white";
  }

  // 60 giorni divisi in 3 fasce:
  // 0-20 rosso, 21-40 arancio, 41-60 verde
  if (giorni <= 20) {
    return "bg-red-500 text-white";
  }

  if (giorni <= 40) {
    return "bg-orange-400 text-white";
  }

  return "bg-green-500 text-white";
}

export function getLabelGiorniResidui(
  giorni: number | null | undefined
): string {
  if (giorni === null || giorni === undefined) return "N/D";
  if (giorni < 0) return `Scaduto da ${Math.abs(giorni)} gg`;
  if (giorni === 0) return "Scade oggi";
  if (giorni === 1) return "1 giorno";

  return `${giorni} giorni`;
}
