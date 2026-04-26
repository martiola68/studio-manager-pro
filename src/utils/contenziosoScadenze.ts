export function calcolaGiorniResidui(dataScadenza?: string | null): number | null {
  if (!dataScadenza) return null;

  const oggi = new Date();
  oggi.setHours(0, 0, 0, 0);

  const scadenza = new Date(dataScadenza);
  scadenza.setHours(0, 0, 0, 0);

  const diffMs = scadenza.getTime() - oggi.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export function getClasseGiorniResidui(giorni: number | null | undefined): string {
  if (giorni === null || giorni === undefined) {
    return "bg-gray-200 text-gray-700";
  }

  if (giorni < 0) {
    return "bg-red-700 text-white"; // scaduto
  }

  if (giorni <= 20) {
    return "bg-red-500 text-white"; // 🔴 URGENTE
  }

  if (giorni <= 40) {
    return "bg-orange-400 text-white"; // 🟠 attenzione
  }

  return "bg-green-500 text-white"; // 🟢 ok
}

export function getLabelGiorniResidui(giorni: number | null | undefined): string {
  if (giorni === null || giorni === undefined) return "N/D";
  if (giorni < 0) return `Scaduto da ${Math.abs(giorni)} gg`;
  if (giorni === 0) return "Scade oggi";
  if (giorni === 1) return "1 giorno";
  return `${giorni} giorni`;
}
