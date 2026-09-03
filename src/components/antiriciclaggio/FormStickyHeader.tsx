import { useEffect, useRef } from "react";

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
  "inline-flex h-9 w-32 items-center justify-center rounded-md border border-sky-700 bg-sky-700 px-3 text-center text-sm font-semibold leading-tight text-white shadow-sm transition-colors hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-50";

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
  const headerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const shell = headerRef.current?.parentElement;
    if (!shell) return;

    shell.classList.add("aml-form-shell");
    return () => shell.classList.remove("aml-form-shell");
  }, []);

  return (
    <>
      <div
        ref={headerRef}
        className="sticky top-0 z-30 border-b-[6px] border-slate-500 bg-background"
      >
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

      <style jsx global>{`
        .aml-form-shell button:not([role="checkbox"]):not([data-aml-button-exclude="true"]) {
          display: inline-flex !important;
          width: 8rem !important;
          min-width: 8rem !important;
          height: 2.25rem !important;
          min-height: 2.25rem !important;
          align-items: center !important;
          justify-content: center !important;
          border: 1px solid rgb(3 105 161) !important;
          border-radius: 0.375rem !important;
          background-color: rgb(3 105 161) !important;
          padding: 0 0.75rem !important;
          color: white !important;
          font-size: 0.875rem !important;
          font-weight: 600 !important;
          line-height: 1.05 !important;
          text-align: center !important;
          white-space: normal !important;
          box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05) !important;
          transition: background-color 150ms ease !important;
        }

        .aml-form-shell button:not([role="checkbox"]):not([data-aml-button-exclude="true"]):hover {
          background-color: rgb(7 89 133) !important;
        }

        .aml-form-shell button:not([role="checkbox"]):not([data-aml-button-exclude="true"]):disabled {
          cursor: not-allowed !important;
          opacity: 0.5 !important;
        }
      `}</style>
    </>
  );
}
