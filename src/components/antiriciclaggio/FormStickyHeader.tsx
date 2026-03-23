type FormStickyHeaderProps = {
  title: string;
  subtitle?: string;
  onSave?: () => void;
  onPrint?: () => void;
  onClose?: () => void;
  onSendToClient?: () => void;
  saving?: boolean;
  beforeSaveSlot?: React.ReactNode;
  showSendToClient?: boolean;
};

export default function FormStickyHeader({
  title,
  subtitle,
  onSave,
  onPrint,
  onClose,
  onSendToClient,
  saving = false,
  beforeSaveSlot,
  showSendToClient = false,
}: FormStickyHeaderProps) {
  return (
    <div className="sticky top-0 z-30 border-b bg-background">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-6">
        <div>
          <h1 className="text-4xl font-bold text-slate-900">{title}</h1>
          {subtitle ? <p className="mt-2 text-slate-600">{subtitle}</p> : null}
        </div>

        <div className="flex items-center gap-3">
          {beforeSaveSlot}

          {showSendToClient && onSendToClient && (
            <button
              type="button"
              onClick={onSendToClient}
              className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700"
            >
              Invia AV4 al cliente
            </button>
          )}

          {onSave && (
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="rounded-2xl border border-emerald-400 bg-emerald-50 p-4"
            >
              Salva
            </button>
          )}

          {onPrint && (
            <button
              type="button"
              onClick={onPrint}
              className="rounded-2xl border border-sky-400 bg-sky-50 p-4"
            >
              Stampa
            </button>
          )}

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-rose-400 bg-rose-50 p-4"
            >
              Chiudi
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
