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
  sendToClientDisabled?: boolean;
};

const actionButtonClass =
  "inline-flex h-9 w-32 items-center justify-center rounded-md border border-sky-700 bg-sky-700 px-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-50";

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
  sendToClientDisabled = false,
}: FormStickyHeaderProps) {
  return (
    <div className="sticky top-0 z-30 border-b bg-background">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-6">
        <div>
          <h1 className="text-4xl font-bold text-slate-900">{title}</h1>
          {subtitle ? <p className="mt-2 text-slate-600">{subtitle}</p> : null}
        </div>

        <div className="flex items-center gap-2">
          {beforeSaveSlot}

          {showSendToClient && onSendToClient && (
            <button
              type="button"
              onClick={onSendToClient}
              disabled={sendToClientDisabled}
              className={actionButtonClass}
            >
              Invia AV4 al cliente
            </button>
          )}

          {onSave && (
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className={actionButtonClass}
            >
              Salva
            </button>
          )}

          {onPrint && (
            <button
              type="button"
              onClick={onPrint}
              className={actionButtonClass}
            >
              Stampa
            </button>
          )}

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className={actionButtonClass}
            >
              Chiudi
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
